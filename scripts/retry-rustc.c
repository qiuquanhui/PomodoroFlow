/* rustc 启动包装器 v7：
 * - 命令行 ≤ 7500 字符：直接隔离启动（stdio 白名单句柄传递）
 * - 超长命令（如 windows crate 的巨型 --check-cfg）：自动改写为 rustc @响应文件，
 *   绕开 cmd.exe 8191 字符上限
 * - 兜底：0xC0000005 重试（历史遗留，现根因已治愈，保留无害）
 * - 输出经临时文件捕获后转发，cargo 仍能读到诊断
 */
#include <windows.h>
#include <stdio.h>
#include <string.h>

static void append_arg(char *buf, size_t cap, const char *arg) {
    size_t len = strlen(buf);
    if (len + 1 >= cap) return;
    buf[len] = ' ';
    buf[len + 1] = '\0';
    int need_quote = strpbrk(arg, " \t\"") != NULL;
    if (!need_quote) { strncat(buf, arg, cap - strlen(buf) - 1); return; }
    strncat(buf, "\"", cap - strlen(buf) - 1);
    for (const char *p = arg; *p; p++) {
        int backslashes = 0;
        while (*p == '\\') { backslashes++; p++; }
        if (*p == '"' || *p == '\0') {
            for (int i = 0; i < backslashes * 2; i++) strncat(buf, "\\", cap - strlen(buf) - 1);
            if (*p == '"') strncat(buf, "\\\"", cap - strlen(buf) - 1);
        } else {
            for (int i = 0; i < backslashes; i++) strncat(buf, "\\", cap - strlen(buf) - 1);
            char tmp[2] = {*p, 0};
            strncat(buf, tmp, cap - strlen(buf) - 1);
        }
        if (*p == '\0') break;
    }
    strncat(buf, "\"", cap - strlen(buf) - 1);
}

static HANDLE capture_file(char *path, DWORD len, const char *suffix) {
    char tmpdir[MAX_PATH];
    GetTempPathA(MAX_PATH, tmpdir);
    snprintf(path, len, "%spf-rustc-%lu-%s.tmp", tmpdir, GetCurrentProcessId(), suffix);
    HANDLE h = CreateFileA(path, GENERIC_READ | GENERIC_WRITE, 0, NULL,
                           CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY, NULL);
    if (h != INVALID_HANDLE_VALUE)
        SetHandleInformation(h, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
    return h;
}

static void forward_file(HANDLE h, DWORD which_std) {
    if (h == INVALID_HANDLE_VALUE) return;
    SetFilePointer(h, 0, NULL, FILE_BEGIN);
    char buf[8192];
    DWORD n;
    while (ReadFile(h, buf, sizeof(buf), &n, NULL) && n > 0) {
        DWORD wrote;
        if (which_std == STD_OUTPUT_HANDLE)
            WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), buf, n, &wrote, NULL);
        else
            WriteFile(GetStdHandle(STD_ERROR_HANDLE), buf, n, &wrote, NULL);
    }
}

static int spawn_isolated(const char *cmdline, char out_path[MAX_PATH], char err_path[MAX_PATH]) {
    HANDLE hOut = capture_file(out_path, MAX_PATH, "out");
    HANDLE hErr = capture_file(err_path, MAX_PATH, "err");
    HANDLE hIn = CreateFileA("NUL", GENERIC_READ, 0, NULL, OPEN_EXISTING, 0, NULL);
    if (hIn != INVALID_HANDLE_VALUE)
        SetHandleInformation(hIn, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);

    STARTUPINFOEXA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.StartupInfo.cb = sizeof(si);
    si.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    si.StartupInfo.hStdInput = hIn;
    si.StartupInfo.hStdOutput = hOut;
    si.StartupInfo.hStdError = hErr;

    SIZE_T attr_size = 0;
    InitializeProcThreadAttributeList(NULL, 1, 0, &attr_size);
    si.lpAttributeList = (LPPROC_THREAD_ATTRIBUTE_LIST)HeapAlloc(GetProcessHeap(), 0, attr_size);
    if (!si.lpAttributeList || !InitializeProcThreadAttributeList(si.lpAttributeList, 1, 0, &attr_size)) {
        fprintf(stderr, "retry-rustc: attr list init failed\n");
        return -2;
    }
    HANDLE inherit_handles[3] = {hIn, hOut, hErr};
    if (!UpdateProcThreadAttribute(si.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                                   inherit_handles, 3 * sizeof(HANDLE), NULL, NULL)) {
        fprintf(stderr, "retry-rustc: UpdateProcThreadAttribute failed\n");
        return -2;
    }

    if (!CreateProcessA(NULL, (char *)cmdline, NULL, NULL, TRUE, EXTENDED_STARTUPINFO_PRESENT,
                        NULL, NULL, (LPSTARTUPINFOA)&si, &pi)) {
        fprintf(stderr, "retry-rustc: CreateProcess failed (%lu)\n", GetLastError());
        return -2;
    }
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD code = 0;
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    DeleteProcThreadAttributeList(si.lpAttributeList);
    HeapFree(GetProcessHeap(), 0, si.lpAttributeList);
    CloseHandle(hIn);
    forward_file(hOut, STD_OUTPUT_HANDLE);
    CloseHandle(hOut);
    forward_file(hErr, STD_ERROR_HANDLE);
    CloseHandle(hErr);
    return (int)code;
}

/** 把 rustc 参数写入响应文件（UTF-8），返回文件路径。 */
static int write_response_file(const char *rustc, char **argv, int argc, char *path, DWORD cap) {
    char tmpdir[MAX_PATH];
    GetTempPathA(MAX_PATH, tmpdir);
    snprintf(path, cap, "%spf-rustc-%lu.rsp", tmpdir, GetCurrentProcessId());
    FILE *f = fopen(path, "wb");
    if (!f) return -1;
    for (int i = 2; i < argc; i++) {
        const char *a = argv[i];
        if (strpbrk(a, " \t\"\n")) {
            fputc('"', f);
            for (const char *p = a; *p; p++) {
                if (*p == '"' || *p == '\\') fputc('\\', f);
                fputc(*p, f);
            }
            fputc('"', f);
        } else {
            fputs(a, f);
        }
        fputc('\n', f);
    }
    fclose(f);
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 2) return 2;

    SetEnvironmentVariableA("CARGO_MAKEFLAGS", NULL);
    SetEnvironmentVariableA("MAKEFLAGS", NULL);

    char cmdline[32768];
    snprintf(cmdline, sizeof(cmdline), "\"%s\"", argv[1]);
    for (int i = 2; i < argc; i++) append_arg(cmdline, sizeof(cmdline), argv[i]);

    char out_path[MAX_PATH], err_path[MAX_PATH];
    for (int i = 0; i < 20; i++) {
        int code = spawn_isolated(cmdline, out_path, err_path);
        if (code != -2) DeleteFileA(out_path), DeleteFileA(err_path);
        if (code != 0xC0000005) return code == -2 ? 2 : code;
    }
    fprintf(stderr, "retry-rustc: rustc kept crashing (0xC0000005) after 20 tries\n");
    return 1;
}
