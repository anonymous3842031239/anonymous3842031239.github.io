/**
 * Demo page for Emotion-Preserving Streaming Speaker Anonymization
 * WaveSurfer.js v7 initialization, tab switching, play-row functionality
 */

(function () {
    'use strict';

    // --- Configuration ---
    const EMOTIONS = ['angry', 'happy', 'sad', 'neutral'];
    const METHODS = ['original', 'sva', 'sva_emo', 'darkstream', 'tvtsyn', 'ours'];
    const UTTERANCES = ['01', '02', '03'];
    const ABLATION_CONFIGS = ['sva_emo', 'sft', 'sft_acou', 'ours'];
    const ABLATION_LABELS = ['SVA+EMO', '+SFT', '+SFT+Acou', 'Ours (full)'];

    const EMOTION_COLORS = {
        angry: '#b84233',
        happy: '#d4943a',
        sad: '#5a7f94',
        neutral: '#7a7672'
    };

    const wavesurfers = {};
    let currentEmotion = 'angry';
    let playRowQueue = [];
    let playRowIndex = 0;

    // --- WaveSurfer Factory ---
    function createWaveSurfer(container, audioSrc, color) {
        const id = container.id;
        if (!id) return null;

        const ws = WaveSurfer.create({
            container: container,
            height: container.closest('.spotlight') ? 64 : 48,
            waveColor: color || '#b0b8c4',
            progressColor: color ? shadeColor(color, -20) : '#7b8a9a',
            cursorColor: '#c4654a',
            cursorWidth: 2,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            normalize: true,
            hideScrollbar: true,
            interact: true,
        });

        // Create play button
        var playBtn = document.createElement('button');
        playBtn.className = 'wave-play-btn';
        playBtn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14"><polygon points="3,1 13,8 3,15" fill="currentColor"/></svg>';
        playBtn.setAttribute('aria-label', 'Play');
        container.style.position = 'relative';
        container.appendChild(playBtn);

        playBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            ws.playPause();
        });

        try {
            ws.load(audioSrc);
        } catch (e) {
            container.classList.add('no-audio');
            container.textContent = 'Audio pending';
            return null;
        }

        ws.on('error', function () {
            container.classList.add('no-audio');
            container.innerHTML = '<span>Audio pending</span>';
        });

        ws.on('ready', function () {
            playBtn.style.opacity = '1';
        });

        ws.on('play', function () {
            playBtn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="1" width="4" height="14" rx="1" fill="currentColor"/><rect x="10" y="1" width="4" height="14" rx="1" fill="currentColor"/></svg>';
            playBtn.setAttribute('aria-label', 'Pause');
            // Stop other players
            Object.keys(wavesurfers).forEach(function (key) {
                if (key !== id && wavesurfers[key]) {
                    wavesurfers[key].pause();
                }
            });
        });

        ws.on('pause', function () {
            playBtn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14"><polygon points="3,1 13,8 3,15" fill="currentColor"/></svg>';
            playBtn.setAttribute('aria-label', 'Play');
        });

        ws.on('finish', function () {
            playBtn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14"><polygon points="3,1 13,8 3,15" fill="currentColor"/></svg>';
            playBtn.setAttribute('aria-label', 'Play');
            if (playRowQueue.length > 0 && playRowIndex < playRowQueue.length - 1) {
                playRowIndex++;
                var nextWs = wavesurfers[playRowQueue[playRowIndex]];
                if (nextWs) nextWs.play();
            } else {
                playRowQueue = [];
                playRowIndex = 0;
            }
        });

        wavesurfers[id] = ws;
        return ws;
    }

    function shadeColor(color, percent) {
        var num = parseInt(color.replace('#', ''), 16);
        var amt = Math.round(2.55 * percent);
        var R = (num >> 16) + amt;
        var G = (num >> 8 & 0x00FF) + amt;
        var B = (num & 0x0000FF) + amt;
        return '#' + (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }

    // --- Build Comparison Grid ---
    function buildComparisonGrid(emotion) {
        var grid = document.getElementById('comparison-grid');
        var rows = grid.querySelectorAll('.grid-row');
        rows.forEach(function (row) { row.remove(); });

        Object.keys(wavesurfers).forEach(function (key) {
            if (key.startsWith('wave-comp-')) {
                if (wavesurfers[key]) wavesurfers[key].destroy();
                delete wavesurfers[key];
            }
        });

        var color = EMOTION_COLORS[emotion];

        UTTERANCES.forEach(function (utt) {
            var row = document.createElement('div');
            row.className = 'grid-row';

            var labelCell = document.createElement('div');
            labelCell.className = 'row-label';

            var playBtn = document.createElement('button');
            playBtn.className = 'play-row-btn';
            playBtn.textContent = 'Play all';
            playBtn.setAttribute('data-utterance', utt);
            playBtn.addEventListener('click', function () {
                playRow(emotion, utt);
            });

            labelCell.innerHTML = 'Utt ' + utt + ' ';
            labelCell.appendChild(playBtn);
            row.appendChild(labelCell);

            METHODS.forEach(function (method) {
                var cell = document.createElement('div');
                cell.className = 'grid-cell';
                var waveDiv = document.createElement('div');
                waveDiv.className = 'waveform';
                var waveId = 'wave-comp-' + emotion + '-' + utt + '-' + method;
                waveDiv.id = waveId;
                waveDiv.setAttribute('data-src', 'audio/' + emotion + '/' + utt + '_' + method + '.wav');
                cell.appendChild(waveDiv);
                row.appendChild(cell);
            });

            grid.appendChild(row);
        });

        requestAnimationFrame(function () {
            grid.querySelectorAll('.grid-row .waveform').forEach(function (el) {
                if (el.id && !wavesurfers[el.id]) {
                    createWaveSurfer(el, el.getAttribute('data-src'), color);
                }
            });
        });
    }

    // --- Play Row ---
    function playRow(emotion, utterance) {
        Object.values(wavesurfers).forEach(function (ws) {
            if (ws) ws.pause();
        });

        playRowQueue = METHODS.map(function (method) {
            return 'wave-comp-' + emotion + '-' + utterance + '-' + method;
        });
        playRowIndex = 0;

        var firstWs = wavesurfers[playRowQueue[0]];
        if (firstWs) {
            firstWs.seekTo(0);
            firstWs.play();
        }
    }

    // --- Build Ablation Grid ---
    function buildAblationGrid() {
        var grid = document.getElementById('ablation-grid');
        if (!grid) return;

        ['01', '02'].forEach(function (utt) {
            var header = document.createElement('h4');
            header.textContent = 'Sad Utterance ' + utt;
            header.style.margin = '16px 0 8px';
            header.style.fontSize = '0.95rem';
            grid.appendChild(header);

            var row = document.createElement('div');
            row.className = 'ablation-row';
            row.style.gridTemplateColumns = 'repeat(' + ABLATION_CONFIGS.length + ', 1fr)';

            ABLATION_CONFIGS.forEach(function (config, i) {
                var cell = document.createElement('div');

                var label = document.createElement('div');
                label.className = 'ablation-label';
                label.textContent = ABLATION_LABELS[i];
                cell.appendChild(label);

                var waveDiv = document.createElement('div');
                waveDiv.className = 'waveform';
                var waveId = 'wave-abl-' + utt + '-' + config;
                waveDiv.id = waveId;
                waveDiv.setAttribute('data-src', 'audio/sad/' + utt + '_' + config + '.wav');
                cell.appendChild(waveDiv);

                row.appendChild(cell);
            });

            grid.appendChild(row);
        });

        requestAnimationFrame(function () {
            grid.querySelectorAll('.waveform').forEach(function (el) {
                if (el.id && !wavesurfers[el.id]) {
                    createWaveSurfer(el, el.getAttribute('data-src'), EMOTION_COLORS.sad);
                }
            });
        });
    }

    // --- Tab Switching ---
    function initTabs() {
        var tabs = document.querySelectorAll('.emotion-tabs .tab');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                tabs.forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
                currentEmotion = tab.getAttribute('data-emotion');
                buildComparisonGrid(currentEmotion);
            });
        });
    }

    // --- Initialize Spotlight Waveforms ---
    function initSpotlight() {
        document.querySelectorAll('.spotlight .waveform').forEach(function (el) {
            if (el.id) {
                createWaveSurfer(el, el.getAttribute('data-src'), EMOTION_COLORS.sad);
            }
        });
    }

    // --- Init ---
    function init() {
        initTabs();
        initSpotlight();
        buildComparisonGrid('angry');
        buildAblationGrid();
    }

    if (typeof WaveSurfer !== 'undefined') {
        init();
    } else {
        var checkInterval = setInterval(function () {
            if (typeof WaveSurfer !== 'undefined') {
                clearInterval(checkInterval);
                init();
            }
        }, 100);
        setTimeout(function () {
            clearInterval(checkInterval);
            document.querySelectorAll('.waveform').forEach(function (el) {
                el.classList.add('no-audio');
                el.innerHTML = '<span>Audio pending</span>';
            });
        }, 5000);
    }
})();
