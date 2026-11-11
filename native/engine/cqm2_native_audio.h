/* SPDX-License-Identifier: LicenseRef-CQM2-Proprietary */
#pragma once

#include <atomic>
#include <cstdint>
#include <mutex>
#include <thread>

namespace cqm2_audio {

inline constexpr int kSongCount = 9;
extern const char* const kSongNames[kSongCount];

enum class SfxId : int {
    Split = 0,
    Burst = 1,
    Mutate = 2,
    Chaos = 3,
    God = 4,
    Nhi = 5,
    Unlock = 6,
    Shatter = 7
};

class NativeAudioEngine {
public:
    NativeAudioEngine() = default;
    ~NativeAudioEngine();

    bool start(bool headlessSilent = false);
    void stop();

    void setMusicEnabled(bool on) { m_musicOn.store(on, std::memory_order_relaxed); }
    bool isMusicEnabled() const { return m_musicOn.load(std::memory_order_relaxed); }

    void setSfxEnabled(bool on) { m_sfxOn.store(on, std::memory_order_relaxed); }
    bool isSfxEnabled() const { return m_sfxOn.load(std::memory_order_relaxed); }

    void setMuted(bool m) { m_muted.store(m, std::memory_order_relaxed); }
    bool isMuted() const { return m_muted.load(std::memory_order_relaxed); }

    void setMasterGain(float g) { m_gain.store(g, std::memory_order_relaxed); }
    float masterGain() const { return m_gain.load(std::memory_order_relaxed); }

    void nextSong();
    void setSongIndex(int idx);
    int songIndex() const { return m_songIdx.load(std::memory_order_relaxed); }
    const char* songName() const;

    void triggerSfx(SfxId id);
    float currentBassLevel() const { return m_bassLevel.load(std::memory_order_relaxed); }

private:
    void audioThreadLoop();
    void renderBlock(int16_t* interleavedStereo, int frames);

    std::atomic<bool> m_running{false};
    std::atomic<bool> m_musicOn{false};
    std::atomic<bool> m_sfxOn{true};
    std::atomic<bool> m_muted{false};
    std::atomic<float> m_gain{0.42f};
    std::atomic<int> m_songIdx{0};
    std::atomic<float> m_bassLevel{0.0f};

    struct ActiveSfx {
        SfxId id{SfxId::Split};
        double t{0.0};
        double dur{0.35};
        bool active{false};
    };
    std::mutex m_sfxMtx;
    ActiveSfx m_voices[6]{};

    double m_sampleTime{0.0};
    std::thread m_worker;
};

} // namespace cqm2_audio
