/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#include "cqm2_native_audio.h"

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <mmsystem.h>
#endif

#include <algorithm>
#include <cmath>
#include <cstring>

namespace cqm2_audio {

const char* const kSongNames[kSongCount] = {
    "VOIDCROWN",
    "DEEP MEDITATION",
    "MECHALOGODROM HYMN",
    "KERR HORIZON",
    "XYLOS POINCARE",
    "ARCHON LITURGY",
    "CHIRAL XENOMIMIC",
    "PANTHEON REQUIEM",
    "OMEGA SINGULARITY"
};

namespace {
constexpr int kSampleRate = 44100;
constexpr int kFramesPerBuf = 1024;
constexpr int kNumBufs = 4;
constexpr double kTwoPi = 6.28318530717958647692;

struct SongSpec {
    double rootHz;
    double tempoBpm;
    int ratios[5]; // numerator over 8 or harmonic scale steps
    double shimmer;
};

const SongSpec kSpecs[kSongCount] = {
    { 55.00,  72.0, { 8, 12, 15, 18, 24 }, 0.35 }, // VOIDCROWN (A1 dark fifth + maj7)
    { 65.41,  54.0, { 8, 10, 12, 15, 20 }, 0.22 }, // DEEP MEDITATION (C2 lydian drone)
    { 73.42,  88.0, { 8, 12, 16, 19, 24 }, 0.48 }, // MECHALOGODROM HYMN (D2 cathedral)
    { 49.00,  96.0, { 8,  9, 12, 15, 22 }, 0.55 }, // KERR HORIZON (G1 phrygian relativistic)
    { 82.41,  78.0, { 8, 11, 13, 16, 21 }, 0.40 }, // XYLOS POINCARE (E2 golden-ratio)
    { 58.27,  64.0, { 8, 12, 14, 18, 24 }, 0.30 }, // ARCHON LITURGY (Bb1 gnostic choir)
    { 69.30, 108.0, { 8, 10, 13, 17, 22 }, 0.62 }, // CHIRAL XENOMIMIC (C#2 mirror arpeggio)
    { 61.74,  68.0, { 8, 12, 15, 16, 24 }, 0.38 }, // PANTHEON REQUIEM (B1 minor)
    { 43.65, 116.0, { 8, 12, 16, 20, 28 }, 0.70 }  // OMEGA SINGULARITY (F1 sub-harmonic)
};
} // namespace

NativeAudioEngine::~NativeAudioEngine() {
    stop();
}

bool NativeAudioEngine::start(bool headlessSilent) {
    if (m_running.load()) return true;
    if (headlessSilent) return true;
    m_running.store(true);
    m_worker = std::thread(&NativeAudioEngine::audioThreadLoop, this);
    return true;
}

void NativeAudioEngine::stop() {
    if (!m_running.exchange(false)) return;
    if (m_worker.joinable()) m_worker.join();
}

void NativeAudioEngine::nextSong() {
    int cur = m_songIdx.load(std::memory_order_relaxed);
    m_songIdx.store((cur + 1) % kSongCount, std::memory_order_relaxed);
}

void NativeAudioEngine::setSongIndex(int idx) {
    int wrapped = ((idx % kSongCount) + kSongCount) % kSongCount;
    m_songIdx.store(wrapped, std::memory_order_relaxed);
}

const char* NativeAudioEngine::songName() const {
    int idx = std::clamp(m_songIdx.load(std::memory_order_relaxed), 0, kSongCount - 1);
    return kSongNames[idx];
}

void NativeAudioEngine::triggerSfx(SfxId id) {
    if (!m_sfxOn.load(std::memory_order_relaxed) || m_muted.load(std::memory_order_relaxed)) return;
    std::lock_guard<std::mutex> lk(m_sfxMtx);
    int slot = 0;
    double oldest = -1.0;
    for (int i = 0; i < 6; ++i) {
        if (!m_voices[i].active) {
            slot = i;
            oldest = 1e9;
            break;
        }
        if (m_voices[i].t > oldest) {
            oldest = m_voices[i].t;
            slot = i;
        }
    }
    double dur = 0.32;
    switch (id) {
        case SfxId::Split: dur = 0.22; break;
        case SfxId::Burst: dur = 0.42; break;
        case SfxId::Mutate: dur = 0.30; break;
        case SfxId::Chaos: dur = 0.55; break;
        case SfxId::God: dur = 0.85; break;
        case SfxId::Nhi: dur = 0.65; break;
        case SfxId::Unlock: dur = 0.90; break;
        case SfxId::Shatter: dur = 0.58; break;
    }
    m_voices[slot] = { id, 0.0, dur, true };
}

void NativeAudioEngine::renderBlock(int16_t* out, int frames) {
    const bool muted = m_muted.load(std::memory_order_relaxed);
    const bool music = m_musicOn.load(std::memory_order_relaxed);
    const float gain = std::clamp(m_gain.load(std::memory_order_relaxed), 0.0f, 1.0f);
    const int songIdx = std::clamp(m_songIdx.load(std::memory_order_relaxed), 0, kSongCount - 1);
    const SongSpec& sp = kSpecs[songIdx];
    const double dt = 1.0 / static_cast<double>(kSampleRate);

    if (muted) {
        std::memset(out, 0, static_cast<size_t>(frames) * 2 * sizeof(int16_t));
        m_bassLevel.store(0.0f, std::memory_order_relaxed);
        m_sampleTime += dt * frames;
        return;
    }

    double bassAcc = 0.0;
    std::lock_guard<std::mutex> lk(m_sfxMtx);

    for (int f = 0; f < frames; ++f) {
        const double t = m_sampleTime;
        m_sampleTime += dt;

        double L = 0.0;
        double R = 0.0;

        if (music) {
            const double beat = t * (sp.tempoBpm / 60.0);
            const int step = static_cast<int>(beat * 2.0) % 5;
            const double envPulse = 0.55 + 0.45 * std::exp(-3.2 * std::fmod(beat, 1.0));
            const double bass = std::sin(kTwoPi * sp.rootHz * t) * 0.32 * envPulse
                              + std::sin(kTwoPi * (sp.rootHz * 0.5) * t) * 0.18;
            bassAcc += std::abs(bass);

            const double arpFreq = sp.rootHz * (static_cast<double>(sp.ratios[step]) / 8.0) * 2.0;
            const double arpEnv = std::exp(-5.0 * std::fmod(beat * 2.0, 1.0));
            const double arp = std::sin(kTwoPi * arpFreq * t + sp.shimmer * std::sin(kTwoPi * arpFreq * 2.0 * t)) * 0.16 * arpEnv;

            const double pad1 = std::sin(kTwoPi * (sp.rootHz * 1.501) * t) * 0.11;
            const double pad2 = std::sin(kTwoPi * (sp.rootHz * (static_cast<double>(sp.ratios[2]) / 8.0)) * t + 0.4 * std::sin(0.7 * t)) * 0.10;

            const double pan = 0.5 + 0.35 * std::sin(0.45 * t);
            L += bass + pad1 + arp * pan + pad2 * (1.0 - pan);
            R += bass + pad2 + arp * (1.0 - pan) + pad1 * pan;
        }

        for (int v = 0; v < 6; ++v) {
            ActiveSfx& vx = m_voices[v];
            if (!vx.active) continue;
            const double u = vx.t / vx.dur;
            if (u >= 1.0) {
                vx.active = false;
                continue;
            }
            const double env = (1.0 - u) * (1.0 - u);
            double sig = 0.0;
            switch (vx.id) {
                case SfxId::Split:
                    sig = std::sin(kTwoPi * (320.0 + 540.0 * u) * vx.t) * env * 0.35;
                    break;
                case SfxId::Burst:
                    sig = std::sin(kTwoPi * (190.0 - 110.0 * u) * vx.t + 3.0 * std::sin(95.0 * vx.t)) * env * 0.42;
                    break;
                case SfxId::Mutate:
                    sig = std::sin(kTwoPi * (440.0 + 180.0 * std::sin(42.0 * vx.t)) * vx.t) * env * 0.30;
                    break;
                case SfxId::Chaos:
                    sig = std::sin(kTwoPi * 110.0 * vx.t + 6.0 * std::sin(311.0 * vx.t)) * env * 0.40;
                    break;
                case SfxId::God:
                    sig = (std::sin(kTwoPi * 110.0 * vx.t) + std::sin(kTwoPi * 165.0 * vx.t) + std::sin(kTwoPi * 220.0 * vx.t)) * env * 0.22;
                    break;
                case SfxId::Nhi:
                    sig = std::sin(kTwoPi * (660.0 - 280.0 * u) * vx.t + 2.5 * std::cos(48.0 * vx.t)) * env * 0.34;
                    break;
                case SfxId::Unlock:
                    sig = (std::sin(kTwoPi * 523.25 * vx.t) + std::sin(kTwoPi * 659.25 * vx.t) + std::sin(kTwoPi * 783.99 * vx.t)) * env * 0.24;
                    break;
                case SfxId::Shatter: {
                    uint32_t h = static_cast<uint32_t>(vx.t * 88200.0) * 747796405u + 2891336453u;
                    double nz = (static_cast<double>(h & 0xFFFFu) / 32768.0) - 1.0;
                    sig = (nz * 0.55 + std::sin(kTwoPi * 920.0 * vx.t) * 0.45) * env * 0.38;
                    break;
                }
            }
            L += sig;
            R += sig;
            vx.t += dt;
        }

        L = std::tanh(L * gain);
        R = std::tanh(R * gain);
        out[f * 2] = static_cast<int16_t>(std::clamp(L * 30000.0, -32760.0, 32760.0));
        out[f * 2 + 1] = static_cast<int16_t>(std::clamp(R * 30000.0, -32760.0, 32760.0));
    }

    float bNorm = static_cast<float>( std::clamp((bassAcc / frames) * 2.6, 0.0, 1.0) );
    m_bassLevel.store(bNorm, std::memory_order_relaxed);
}

void NativeAudioEngine::audioThreadLoop() {
#ifdef _WIN32
    WAVEFORMATEX wfx{};
    wfx.wFormatTag = WAVE_FORMAT_PCM;
    wfx.nChannels = 2;
    wfx.nSamplesPerSec = kSampleRate;
    wfx.wBitsPerSample = 16;
    wfx.nBlockAlign = 4;
    wfx.nAvgBytesPerSec = kSampleRate * 4;

    HANDLE hEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    HWAVEOUT hWave = nullptr;
    MMRESULT mm = waveOutOpen(&hWave, WAVE_MAPPER, &wfx, reinterpret_cast<DWORD_PTR>(hEvent), 0, CALLBACK_EVENT);
    if (mm != MMSYSERR_NOERROR || !hWave) {
        if (hEvent) CloseHandle(hEvent);
        return;
    }

    int16_t pcm[kNumBufs][kFramesPerBuf * 2]{};
    WAVEHDR hdrs[kNumBufs]{};
    for (int i = 0; i < kNumBufs; ++i) {
        renderBlock(pcm[i], kFramesPerBuf);
        hdrs[i].lpData = reinterpret_cast<LPSTR>(pcm[i]);
        hdrs[i].dwBufferLength = kFramesPerBuf * 2 * sizeof(int16_t);
        waveOutPrepareHeader(hWave, &hdrs[i], sizeof(WAVEHDR));
        waveOutWrite(hWave, &hdrs[i], sizeof(WAVEHDR));
    }

    while (m_running.load(std::memory_order_relaxed)) {
        WaitForSingleObject(hEvent, 30);
        for (int i = 0; i < kNumBufs; ++i) {
            if (hdrs[i].dwFlags & WHDR_DONE) {
                waveOutUnprepareHeader(hWave, &hdrs[i], sizeof(WAVEHDR));
                renderBlock(pcm[i], kFramesPerBuf);
                hdrs[i].dwFlags = 0;
                waveOutPrepareHeader(hWave, &hdrs[i], sizeof(WAVEHDR));
                waveOutWrite(hWave, &hdrs[i], sizeof(WAVEHDR));
            }
        }
    }

    waveOutReset(hWave);
    for (int i = 0; i < kNumBufs; ++i) {
        if (hdrs[i].dwFlags & WHDR_PREPARED) {
            waveOutUnprepareHeader(hWave, &hdrs[i], sizeof(WAVEHDR));
        }
    }
    waveOutClose(hWave);
    if (hEvent) CloseHandle(hEvent);
#endif
}

} // namespace cqm2_audio
