/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

#include <GL/gl.h>
#include <cstddef>
#include <cstdint>

using GLchar = char;
using GLsizeiptr = std::ptrdiff_t;
using GLintptr = std::ptrdiff_t;

#ifndef GL_ARRAY_BUFFER
#define GL_ARRAY_BUFFER 0x8892
#endif
#ifndef GL_ELEMENT_ARRAY_BUFFER
#define GL_ELEMENT_ARRAY_BUFFER 0x8893
#endif
#ifndef GL_STATIC_DRAW
#define GL_STATIC_DRAW 0x88E4
#endif
#ifndef GL_DYNAMIC_DRAW
#define GL_DYNAMIC_DRAW 0x88E8
#endif
#ifndef GL_STREAM_DRAW
#define GL_STREAM_DRAW 0x88E0
#endif
#ifndef GL_FRAGMENT_SHADER
#define GL_FRAGMENT_SHADER 0x8B30
#endif
#ifndef GL_VERTEX_SHADER
#define GL_VERTEX_SHADER 0x8B31
#endif
#ifndef GL_COMPILE_STATUS
#define GL_COMPILE_STATUS 0x8B81
#endif
#ifndef GL_LINK_STATUS
#define GL_LINK_STATUS 0x8B82
#endif
#ifndef GL_INFO_LOG_LENGTH
#define GL_INFO_LOG_LENGTH 0x8B84
#endif
#ifndef GL_TEXTURE0
#define GL_TEXTURE0 0x84C0
#endif
#ifndef GL_TEXTURE1
#define GL_TEXTURE1 0x84C1
#endif
#ifndef GL_TEXTURE2
#define GL_TEXTURE2 0x84C2
#endif
#ifndef GL_CLAMP_TO_EDGE
#define GL_CLAMP_TO_EDGE 0x812F
#endif
#ifndef GL_RGBA16F
#define GL_RGBA16F 0x881A
#endif
#ifndef GL_RGBA32F
#define GL_RGBA32F 0x8814
#endif
#ifndef GL_FRAMEBUFFER
#define GL_FRAMEBUFFER 0x8D40
#endif
#ifndef GL_RENDERBUFFER
#define GL_RENDERBUFFER 0x8D41
#endif
#ifndef GL_COLOR_ATTACHMENT0
#define GL_COLOR_ATTACHMENT0 0x8CE0
#endif
#ifndef GL_DEPTH_ATTACHMENT
#define GL_DEPTH_ATTACHMENT 0x8D00
#endif
#ifndef GL_DEPTH24_STENCIL8
#define GL_DEPTH24_STENCIL8 0x88F0
#endif
#ifndef GL_DEPTH_STENCIL_ATTACHMENT
#define GL_DEPTH_STENCIL_ATTACHMENT 0x821A
#endif
#ifndef GL_DEPTH_COMPONENT24
#define GL_DEPTH_COMPONENT24 0x81A6
#endif
#ifndef GL_FRAMEBUFFER_COMPLETE
#define GL_FRAMEBUFFER_COMPLETE 0x8CD5
#endif
#ifndef GL_PROGRAM_POINT_SIZE
#define GL_PROGRAM_POINT_SIZE 0x8642
#endif
#ifndef GL_MULTISAMPLE
#define GL_MULTISAMPLE 0x809D
#endif
#ifndef GL_FUNC_ADD
#define GL_FUNC_ADD 0x8006
#endif

#ifndef APIENTRYP
#ifdef _WIN32
#define APIENTRYP APIENTRY *
#else
#define APIENTRYP *
#endif
#endif

using PFNGLCREATESHADERPROC = GLuint(APIENTRYP)(GLenum);
using PFNGLSHADERSOURCEPROC = void(APIENTRYP)(GLuint, GLsizei, const GLchar* const*, const GLint*);
using PFNGLCOMPILESHADERPROC = void(APIENTRYP)(GLuint);
using PFNGLGETSHADERIVPROC = void(APIENTRYP)(GLuint, GLenum, GLint*);
using PFNGLGETSHADERINFOLOGPROC = void(APIENTRYP)(GLuint, GLsizei, GLsizei*, GLchar*);
using PFNGLDELETESHADERPROC = void(APIENTRYP)(GLuint);
using PFNGLCREATEPROGRAMPROC = GLuint(APIENTRYP)(void);
using PFNGLATTACHSHADERPROC = void(APIENTRYP)(GLuint, GLuint);
using PFNGLLINKPROGRAMPROC = void(APIENTRYP)(GLuint);
using PFNGLGETPROGRAMIVPROC = void(APIENTRYP)(GLuint, GLenum, GLint*);
using PFNGLGETPROGRAMINFOLOGPROC = void(APIENTRYP)(GLuint, GLsizei, GLsizei*, GLchar*);
using PFNGLUSEPROGRAMPROC = void(APIENTRYP)(GLuint);
using PFNGLDELETEPROGRAMPROC = void(APIENTRYP)(GLuint);
using PFNGLGETUNIFORMLOCATIONPROC = GLint(APIENTRYP)(GLuint, const GLchar*);
using PFNGLUNIFORM1IPROC = void(APIENTRYP)(GLint, GLint);
using PFNGLUNIFORM1FPROC = void(APIENTRYP)(GLint, GLfloat);
using PFNGLUNIFORM2FPROC = void(APIENTRYP)(GLint, GLfloat, GLfloat);
using PFNGLUNIFORM3FPROC = void(APIENTRYP)(GLint, GLfloat, GLfloat, GLfloat);
using PFNGLUNIFORM4FPROC = void(APIENTRYP)(GLint, GLfloat, GLfloat, GLfloat, GLfloat);
using PFNGLUNIFORM4FVPROC = void(APIENTRYP)(GLint, GLsizei, const GLfloat*);
using PFNGLUNIFORMMATRIX4FVPROC = void(APIENTRYP)(GLint, GLsizei, GLboolean, const GLfloat*);
using PFNGLGENVERTEXARRAYSPROC = void(APIENTRYP)(GLsizei, GLuint*);
using PFNGLBINDVERTEXARRAYPROC = void(APIENTRYP)(GLuint);
using PFNGLDELETEVERTEXARRAYSPROC = void(APIENTRYP)(GLsizei, const GLuint*);
using PFNGLGENBUFFERSPROC = void(APIENTRYP)(GLsizei, GLuint*);
using PFNGLBINDBUFFERPROC = void(APIENTRYP)(GLenum, GLuint);
using PFNGLBUFFERDATAPROC = void(APIENTRYP)(GLenum, GLsizeiptr, const void*, GLenum);
using PFNGLBUFFERSUBDATAPROC = void(APIENTRYP)(GLenum, GLintptr, GLsizeiptr, const void*);
using PFNGLDELETEBUFFERSPROC = void(APIENTRYP)(GLsizei, const GLuint*);
using PFNGLENABLEVERTEXATTRIBARRAYPROC = void(APIENTRYP)(GLuint);
using PFNGLVERTEXATTRIBPOINTERPROC = void(APIENTRYP)(GLuint, GLint, GLenum, GLboolean, GLsizei, const void*);
using PFNGLVERTEXATTRIBDIVISORPROC = void(APIENTRYP)(GLuint, GLuint);
using PFNGLDRAWARRAYSINSTANCEDPROC = void(APIENTRYP)(GLenum, GLint, GLsizei, GLsizei);
using PFNGLDRAWELEMENTSINSTANCEDPROC = void(APIENTRYP)(GLenum, GLsizei, GLenum, const void*, GLsizei);
using PFNGLACTIVETEXTUREPROC = void(APIENTRYP)(GLenum);
using PFNGLGENFRAMEBUFFERSPROC = void(APIENTRYP)(GLsizei, GLuint*);
using PFNGLBINDFRAMEBUFFERPROC = void(APIENTRYP)(GLenum, GLuint);
using PFNGLDELETEFRAMEBUFFERSPROC = void(APIENTRYP)(GLsizei, const GLuint*);
using PFNGLFRAMEBUFFERTEXTURE2DPROC = void(APIENTRYP)(GLenum, GLenum, GLenum, GLuint, GLint);
using PFNGLGENRENDERBUFFERSPROC = void(APIENTRYP)(GLsizei, GLuint*);
using PFNGLBINDRENDERBUFFERPROC = void(APIENTRYP)(GLenum, GLuint);
using PFNGLDELETERENDERBUFFERSPROC = void(APIENTRYP)(GLsizei, const GLuint*);
using PFNGLRENDERBUFFERSTORAGEPROC = void(APIENTRYP)(GLenum, GLenum, GLsizei, GLsizei);
using PFNGLFRAMEBUFFERRENDERBUFFERPROC = void(APIENTRYP)(GLenum, GLenum, GLenum, GLuint);
using PFNGLCHECKFRAMEBUFFERSTATUSPROC = GLenum(APIENTRYP)(GLenum);
using PFNGLBLENDFUNCSEPARATEPROC = void(APIENTRYP)(GLenum, GLenum, GLenum, GLenum);

extern PFNGLCREATESHADERPROC glCreateShader;
extern PFNGLSHADERSOURCEPROC glShaderSource;
extern PFNGLCOMPILESHADERPROC glCompileShader;
extern PFNGLGETSHADERIVPROC glGetShaderiv;
extern PFNGLGETSHADERINFOLOGPROC glGetShaderInfoLog;
extern PFNGLDELETESHADERPROC glDeleteShader;
extern PFNGLCREATEPROGRAMPROC glCreateProgram;
extern PFNGLATTACHSHADERPROC glAttachShader;
extern PFNGLLINKPROGRAMPROC glLinkProgram;
extern PFNGLGETPROGRAMIVPROC glGetProgramiv;
extern PFNGLGETPROGRAMINFOLOGPROC glGetProgramInfoLog;
extern PFNGLUSEPROGRAMPROC glUseProgram;
extern PFNGLDELETEPROGRAMPROC glDeleteProgram;
extern PFNGLGETUNIFORMLOCATIONPROC glGetUniformLocation;
extern PFNGLUNIFORM1IPROC glUniform1i;
extern PFNGLUNIFORM1FPROC glUniform1f;
extern PFNGLUNIFORM2FPROC glUniform2f;
extern PFNGLUNIFORM3FPROC glUniform3f;
extern PFNGLUNIFORM4FPROC glUniform4f;
extern PFNGLUNIFORM4FVPROC glUniform4fv;
extern PFNGLUNIFORMMATRIX4FVPROC glUniformMatrix4fv;
extern PFNGLGENVERTEXARRAYSPROC glGenVertexArrays;
extern PFNGLBINDVERTEXARRAYPROC glBindVertexArray;
extern PFNGLDELETEVERTEXARRAYSPROC glDeleteVertexArrays;
extern PFNGLGENBUFFERSPROC glGenBuffers;
extern PFNGLBINDBUFFERPROC glBindBuffer;
extern PFNGLBUFFERDATAPROC glBufferData;
extern PFNGLBUFFERSUBDATAPROC glBufferSubData;
extern PFNGLDELETEBUFFERSPROC glDeleteBuffers;
extern PFNGLENABLEVERTEXATTRIBARRAYPROC glEnableVertexAttribArray;
extern PFNGLVERTEXATTRIBPOINTERPROC glVertexAttribPointer;
extern PFNGLVERTEXATTRIBDIVISORPROC glVertexAttribDivisor;
extern PFNGLDRAWARRAYSINSTANCEDPROC glDrawArraysInstanced;
extern PFNGLDRAWELEMENTSINSTANCEDPROC glDrawElementsInstanced;
extern PFNGLACTIVETEXTUREPROC glActiveTexture;
extern PFNGLGENFRAMEBUFFERSPROC glGenFramebuffers;
extern PFNGLBINDFRAMEBUFFERPROC glBindFramebuffer;
extern PFNGLDELETEFRAMEBUFFERSPROC glDeleteFramebuffers;
extern PFNGLFRAMEBUFFERTEXTURE2DPROC glFramebufferTexture2D;
extern PFNGLGENRENDERBUFFERSPROC glGenRenderbuffers;
extern PFNGLBINDRENDERBUFFERPROC glBindRenderbuffer;
extern PFNGLDELETERENDERBUFFERSPROC glDeleteRenderbuffers;
extern PFNGLRENDERBUFFERSTORAGEPROC glRenderbufferStorage;
extern PFNGLFRAMEBUFFERRENDERBUFFERPROC glFramebufferRenderbuffer;
extern PFNGLCHECKFRAMEBUFFERSTATUSPROC glCheckFramebufferStatus;
extern PFNGLBLENDFUNCSEPARATEPROC glBlendFuncSeparate;

namespace cqm2_gl {
using GetProcFn = void* (*)(const char*);
bool loadCoreGL(GetProcFn loader);
GLuint compileProgram(const char* vertSrc, const char* fragSrc, char* errLog, size_t errCap);
} // namespace cqm2_gl
