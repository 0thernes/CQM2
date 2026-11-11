/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#include "gl_core.h"
#include <cstdio>
#include <cstring>

// Force Windows 11 Hybrid Graphics (MSI Vector 16 HX AI A2XW) onto NVIDIA GeForce RTX 5070 Ti dGPU!
#ifdef _WIN32
extern "C" {
__declspec(dllexport) DWORD NvOptimusEnablement = 0x00000001;
__declspec(dllexport) int AmdPowerXpressRequestHighPerformance = 1;
}
#endif

PFNGLCREATESHADERPROC glCreateShader = nullptr;
PFNGLSHADERSOURCEPROC glShaderSource = nullptr;
PFNGLCOMPILESHADERPROC glCompileShader = nullptr;
PFNGLGETSHADERIVPROC glGetShaderiv = nullptr;
PFNGLGETSHADERINFOLOGPROC glGetShaderInfoLog = nullptr;
PFNGLDELETESHADERPROC glDeleteShader = nullptr;
PFNGLCREATEPROGRAMPROC glCreateProgram = nullptr;
PFNGLATTACHSHADERPROC glAttachShader = nullptr;
PFNGLLINKPROGRAMPROC glLinkProgram = nullptr;
PFNGLGETPROGRAMIVPROC glGetProgramiv = nullptr;
PFNGLGETPROGRAMINFOLOGPROC glGetProgramInfoLog = nullptr;
PFNGLUSEPROGRAMPROC glUseProgram = nullptr;
PFNGLDELETEPROGRAMPROC glDeleteProgram = nullptr;
PFNGLGETUNIFORMLOCATIONPROC glGetUniformLocation = nullptr;
PFNGLUNIFORM1IPROC glUniform1i = nullptr;
PFNGLUNIFORM1FPROC glUniform1f = nullptr;
PFNGLUNIFORM2FPROC glUniform2f = nullptr;
PFNGLUNIFORM3FPROC glUniform3f = nullptr;
PFNGLUNIFORM4FPROC glUniform4f = nullptr;
PFNGLUNIFORM4FVPROC glUniform4fv = nullptr;
PFNGLUNIFORMMATRIX4FVPROC glUniformMatrix4fv = nullptr;
PFNGLGENVERTEXARRAYSPROC glGenVertexArrays = nullptr;
PFNGLBINDVERTEXARRAYPROC glBindVertexArray = nullptr;
PFNGLDELETEVERTEXARRAYSPROC glDeleteVertexArrays = nullptr;
PFNGLGENBUFFERSPROC glGenBuffers = nullptr;
PFNGLBINDBUFFERPROC glBindBuffer = nullptr;
PFNGLBUFFERDATAPROC glBufferData = nullptr;
PFNGLBUFFERSUBDATAPROC glBufferSubData = nullptr;
PFNGLDELETEBUFFERSPROC glDeleteBuffers = nullptr;
PFNGLENABLEVERTEXATTRIBARRAYPROC glEnableVertexAttribArray = nullptr;
PFNGLVERTEXATTRIBPOINTERPROC glVertexAttribPointer = nullptr;
PFNGLVERTEXATTRIBDIVISORPROC glVertexAttribDivisor = nullptr;
PFNGLDRAWARRAYSINSTANCEDPROC glDrawArraysInstanced = nullptr;
PFNGLDRAWELEMENTSINSTANCEDPROC glDrawElementsInstanced = nullptr;
PFNGLACTIVETEXTUREPROC glActiveTexture = nullptr;
PFNGLGENFRAMEBUFFERSPROC glGenFramebuffers = nullptr;
PFNGLBINDFRAMEBUFFERPROC glBindFramebuffer = nullptr;
PFNGLDELETEFRAMEBUFFERSPROC glDeleteFramebuffers = nullptr;
PFNGLFRAMEBUFFERTEXTURE2DPROC glFramebufferTexture2D = nullptr;
PFNGLGENRENDERBUFFERSPROC glGenRenderbuffers = nullptr;
PFNGLBINDRENDERBUFFERPROC glBindRenderbuffer = nullptr;
PFNGLDELETERENDERBUFFERSPROC glDeleteRenderbuffers = nullptr;
PFNGLRENDERBUFFERSTORAGEPROC glRenderbufferStorage = nullptr;
PFNGLFRAMEBUFFERRENDERBUFFERPROC glFramebufferRenderbuffer = nullptr;
PFNGLCHECKFRAMEBUFFERSTATUSPROC glCheckFramebufferStatus = nullptr;
PFNGLBLENDFUNCSEPARATEPROC glBlendFuncSeparate = nullptr;

namespace cqm2_gl {

bool loadCoreGL(GetProcFn loader) {
    bool ok = true;
#define LOAD_GL(sym)                                                       \
    do {                                                                   \
        sym = reinterpret_cast<decltype(sym)>(loader(#sym));               \
        if (!sym) {                                                        \
            std::fprintf(stderr, "[cqm2_gl] missing symbol: %s\n", #sym);  \
            ok = false;                                                    \
        }                                                                  \
    } while (0)

    LOAD_GL(glCreateShader);
    LOAD_GL(glShaderSource);
    LOAD_GL(glCompileShader);
    LOAD_GL(glGetShaderiv);
    LOAD_GL(glGetShaderInfoLog);
    LOAD_GL(glDeleteShader);
    LOAD_GL(glCreateProgram);
    LOAD_GL(glAttachShader);
    LOAD_GL(glLinkProgram);
    LOAD_GL(glGetProgramiv);
    LOAD_GL(glGetProgramInfoLog);
    LOAD_GL(glUseProgram);
    LOAD_GL(glDeleteProgram);
    LOAD_GL(glGetUniformLocation);
    LOAD_GL(glUniform1i);
    LOAD_GL(glUniform1f);
    LOAD_GL(glUniform2f);
    LOAD_GL(glUniform3f);
    LOAD_GL(glUniform4f);
    LOAD_GL(glUniform4fv);
    LOAD_GL(glUniformMatrix4fv);
    LOAD_GL(glGenVertexArrays);
    LOAD_GL(glBindVertexArray);
    LOAD_GL(glDeleteVertexArrays);
    LOAD_GL(glGenBuffers);
    LOAD_GL(glBindBuffer);
    LOAD_GL(glBufferData);
    LOAD_GL(glBufferSubData);
    LOAD_GL(glDeleteBuffers);
    LOAD_GL(glEnableVertexAttribArray);
    LOAD_GL(glVertexAttribPointer);
    LOAD_GL(glVertexAttribDivisor);
    LOAD_GL(glDrawArraysInstanced);
    LOAD_GL(glDrawElementsInstanced);
    LOAD_GL(glActiveTexture);
    LOAD_GL(glGenFramebuffers);
    LOAD_GL(glBindFramebuffer);
    LOAD_GL(glDeleteFramebuffers);
    LOAD_GL(glFramebufferTexture2D);
    LOAD_GL(glGenRenderbuffers);
    LOAD_GL(glBindRenderbuffer);
    LOAD_GL(glDeleteRenderbuffers);
    LOAD_GL(glRenderbufferStorage);
    LOAD_GL(glFramebufferRenderbuffer);
    LOAD_GL(glCheckFramebufferStatus);
    LOAD_GL(glBlendFuncSeparate);
#undef LOAD_GL
    return ok;
}

static GLuint compileStage(GLenum type, const char* src, char* errLog, size_t errCap) {
    GLuint sh = glCreateShader(type);
    glShaderSource(sh, 1, &src, nullptr);
    glCompileShader(sh);
    GLint status = 0;
    glGetShaderiv(sh, GL_COMPILE_STATUS, &status);
    if (!status) {
        if (errLog && errCap > 0) {
            glGetShaderInfoLog(sh, static_cast<GLsizei>(errCap), nullptr, errLog);
        }
        glDeleteShader(sh);
        return 0;
    }
    return sh;
}

GLuint compileProgram(const char* vertSrc, const char* fragSrc, char* errLog, size_t errCap) {
    if (errLog && errCap > 0) errLog[0] = '\0';
    GLuint vs = compileStage(GL_VERTEX_SHADER, vertSrc, errLog, errCap);
    if (!vs) return 0;
    GLuint fs = compileStage(GL_FRAGMENT_SHADER, fragSrc, errLog, errCap);
    if (!fs) {
        glDeleteShader(vs);
        return 0;
    }
    GLuint prog = glCreateProgram();
    glAttachShader(prog, vs);
    glAttachShader(prog, fs);
    glLinkProgram(prog);
    glDeleteShader(vs);
    glDeleteShader(fs);
    GLint linked = 0;
    glGetProgramiv(prog, GL_LINK_STATUS, &linked);
    if (!linked) {
        if (errLog && errCap > 0) {
            glGetProgramInfoLog(prog, static_cast<GLsizei>(errCap), nullptr, errLog);
        }
        glDeleteProgram(prog);
        return 0;
    }
    return prog;
}

} // namespace cqm2_gl
