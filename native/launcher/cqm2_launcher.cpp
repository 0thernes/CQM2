/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
/**
 * @file cqm2_launcher.cpp
 * @brief Native Win32 GUI Executable (`CQM2.exe`) for Cosmogonic Quantum Mechalogodrom 2.
 *
 * Designed to live directly on Desktop, Windows 11 Taskbar, Start Menu, and `native/bin/CQM2.exe`.
 * - Subsystem: WINDOWS (zero black console window flash!).
 * - Probes `http://127.0.0.1:4320/api/health` via WinSock2.
 * - If not yet running, locates `bun.exe` + `CQM2` workspace root, spawns `bun.exe run src/server/main.ts`
 *   with `CREATE_NO_WINDOW | DETACHED_PROCESS` and `COPILOT_ENABLED=1`, and waits up to 10s for `/api/health`.
 * - Opens a dedicated GPU-accelerated chromeless Edge/Chrome App window (`--enable-webgl2 --enable-unsafe-webgpu`)
 *   or falls back to `ShellExecuteW` default browser.
 * - Flags:
 *     `--smoke`   : Ensures server is healthy on `:4320` and exits 0 without opening a window.
 *     `--mini`    : Opens `/?world=mini`.
 *     `--lab`     : Opens `/lab`.
 *     `--browser` : Opens regular browser tab instead of standalone `--app=` window.
 */
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cwchar>
#include <string>
#include <vector>

#ifndef CQM2_DEFAULT_REPO_W
#define CQM2_DEFAULT_REPO_W L"Z:\\[Vibe Coded (AI)]\\CLAUDECODE\\CQM2"
#endif

namespace {

constexpr unsigned short CQM2_PORT = 4320;

bool fileExistsW(const std::wstring& path) {
    if (path.empty()) return false;
    DWORD attr = GetFileAttributesW(path.c_str());
    return (attr != INVALID_FILE_ATTRIBUTES) && ((attr & FILE_ATTRIBUTE_DIRECTORY) == 0);
}

bool isValidRepoRoot(const std::wstring& dir) {
    if (dir.empty()) return false;
    return fileExistsW(dir + L"\\src\\server\\main.ts") && fileExistsW(dir + L"\\package.json");
}

std::wstring parentDir(const std::wstring& p) {
    size_t pos = p.find_last_of(L"\\/");
    if (pos == std::wstring::npos) return L"";
    return p.substr(0, pos);
}

std::wstring resolveRepoRoot() {
    wchar_t envBuf[MAX_PATH * 2] = {0};
    DWORD n = GetEnvironmentVariableW(L"CQM2_ROOT", envBuf, MAX_PATH * 2);
    if (n > 0 && n < MAX_PATH * 2) {
        std::wstring cand(envBuf);
        if (isValidRepoRoot(cand)) return cand;
    }

    wchar_t exePath[MAX_PATH * 2] = {0};
    GetModuleFileNameW(nullptr, exePath, MAX_PATH * 2);
    std::wstring exeDir = parentDir(exePath);
    if (isValidRepoRoot(exeDir)) return exeDir;
    std::wstring up1 = parentDir(exeDir);
    if (isValidRepoRoot(up1)) return up1;
    std::wstring up2 = parentDir(up1);
    if (isValidRepoRoot(up2)) return up2;

    std::wstring baked(CQM2_DEFAULT_REPO_W);
    if (isValidRepoRoot(baked)) return baked;

    return L"";
}

std::wstring resolveBunExe() {
    wchar_t userProf[MAX_PATH] = {0};
    if (GetEnvironmentVariableW(L"USERPROFILE", userProf, MAX_PATH) > 0) {
        std::wstring cand = std::wstring(userProf) + L"\\.bun\\bin\\bun.exe";
        if (fileExistsW(cand)) return cand;
    }

    wchar_t found[MAX_PATH * 2] = {0};
    if (SearchPathW(nullptr, L"bun.exe", nullptr, MAX_PATH * 2, found, nullptr) > 0) {
        return std::wstring(found);
    }
    return L"";
}

bool probeHealthOnce(unsigned short port) {
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) return false;

    DWORD timeoutMs = 400;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeoutMs), sizeof(timeoutMs));
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeoutMs), sizeof(timeoutMs));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (connect(s, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
        closesocket(s);
        return false;
    }

    const char* req =
        "GET /api/health HTTP/1.1\r\n"
        "Host: 127.0.0.1:4320\r\n"
        "Connection: close\r\n\r\n";
    send(s, req, static_cast<int>(std::strlen(req)), 0);

    char resp[512] = {0};
    int r = recv(s, resp, sizeof(resp) - 1, 0);
    closesocket(s);
    if (r <= 0) return false;
    return (std::strstr(resp, "200 OK") != nullptr) &&
           (std::strstr(resp, "\"ok\"") != nullptr || std::strstr(resp, "cqm2") != nullptr || std::strstr(resp, "healthy") != nullptr);
}

bool spawnServerDaemon(const std::wstring& bunExe, const std::wstring& repoRoot) {
    SetEnvironmentVariableW(L"CQM2_PORT", L"4320");
    SetEnvironmentVariableW(L"PORT", L"4320");
    SetEnvironmentVariableW(L"COPILOT_ENABLED", L"1");
    SetEnvironmentVariableW(L"COPILOT_ALLOW_KEYLESS", L"1");

    std::wstring cmd = L"\"" + bunExe + L"\" run src/server/main.ts";
    std::vector<wchar_t> cmdMutable(cmd.begin(), cmd.end());
    cmdMutable.push_back(L'\0');

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;

    PROCESS_INFORMATION pi{};
    BOOL ok = CreateProcessW(
        bunExe.c_str(),
        cmdMutable.data(),
        nullptr,
        nullptr,
        FALSE,
        CREATE_NO_WINDOW | DETACHED_PROCESS,
        nullptr,
        repoRoot.c_str(),
        &si,
        &pi
    );
    if (!ok) return false;
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return true;
}

std::wstring findAppBrowser() {
    const wchar_t* candidates[] = {
        L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        L"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        L"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        L"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    };
    for (const wchar_t* c : candidates) {
        if (fileExistsW(c)) return std::wstring(c);
    }
    return L"";
}

void openAppWindow(const std::wstring& url, bool forceRegularTab) {
    if (!forceRegularTab) {
        std::wstring browserExe = findAppBrowser();
        if (!browserExe.empty()) {
            std::wstring args =
                L"--app=" + url +
                L" --start-maximized --enable-webgl --enable-webgl2 --enable-unsafe-webgpu --ignore-gpu-blocklist";
            HINSTANCE res = ShellExecuteW(nullptr, L"open", browserExe.c_str(), args.c_str(), nullptr, SW_SHOWNORMAL);
            if (reinterpret_cast<INT_PTR>(res) > 32) {
                return;
            }
        }
    }
    ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

} // namespace

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);

    bool smokeOnly = false;
    bool miniWorld = false;
    bool openLab = false;
    bool regularTab = false;

    if (argv) {
        for (int i = 1; i < argc; ++i) {
            std::wstring a(argv[i]);
            if (a == L"--smoke" || a == L"--headless-check") smokeOnly = true;
            else if (a == L"--mini") miniWorld = true;
            else if (a == L"--lab") openLab = true;
            else if (a == L"--browser") regularTab = true;
        }
        LocalFree(argv);
    }

    WSADATA wsa{};
    WSAStartup(MAKEWORD(2, 2), &wsa);

    bool ready = probeHealthOnce(CQM2_PORT);
    if (!ready) {
        std::wstring repoRoot = resolveRepoRoot();
        std::wstring bunExe = resolveBunExe();
        if (repoRoot.empty() || bunExe.empty()) {
            if (!smokeOnly) {
                MessageBoxW(
                    nullptr,
                    L"CQM2.exe could not locate the CQM2 repository root or bun.exe.\n"
                    L"Expected workspace: Z:\\[Vibe Coded (AI)]\\CLAUDECODE\\CQM2",
                    L"Cosmogonic Quantum Mechalogodrom 2",
                    MB_ICONERROR | MB_OK
                );
            }
            WSACleanup();
            return 2;
        }

        if (!spawnServerDaemon(bunExe, repoRoot)) {
            if (!smokeOnly) {
                MessageBoxW(
                    nullptr,
                    L"Failed to spawn the local CQM2 Quad-Silicon server.",
                    L"Cosmogonic Quantum Mechalogodrom 2",
                    MB_ICONERROR | MB_OK
                );
            }
            WSACleanup();
            return 3;
        }

        for (int attempt = 0; attempt < 100; ++attempt) {
            Sleep(100);
            if (probeHealthOnce(CQM2_PORT)) {
                ready = true;
                break;
            }
        }
    }

    WSACleanup();

    if (!ready) {
        if (!smokeOnly) {
            MessageBoxW(
                nullptr,
                L"CQM2 Quad-Silicon server did not respond on http://127.0.0.1:4320 within 10 seconds.",
                L"Cosmogonic Quantum Mechalogodrom 2",
                MB_ICONWARNING | MB_OK
            );
        }
        return 4;
    }

    if (smokeOnly) {
        return 0;
    }

    std::wstring targetUrl = L"http://127.0.0.1:4320/";
    if (openLab) targetUrl = L"http://127.0.0.1:4320/lab";
    else if (miniWorld) targetUrl = L"http://127.0.0.1:4320/?world=mini";

    openAppWindow(targetUrl, regularTab);
    return 0;
}
