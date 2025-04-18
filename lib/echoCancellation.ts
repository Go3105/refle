/**
 * エコーキャンセリング機能を提供するユーティリティ
 */

declare global {
    interface Window {
        webkitAudioContext?: {
            new(): AudioContext;
        };
    }
}

export class EchoCancellation {
    private audioContext: AudioContext;
    private inputStream: MediaStream | null = null;
    private outputStream: MediaStream | null = null;
    private inputNode: MediaStreamAudioSourceNode | null = null;
    private outputNode: MediaStreamAudioDestinationNode | null = null;
    private gainNode: GainNode | null = null;
    private isActive: boolean = false;
    private noiseGateNode: GainNode | null = null;
    private analyserNode: AnalyserNode | null = null;
    private outputAnalyserNode: AnalyserNode | null = null;
    private lastOutputTime: number = 0;
    private echoDelay: number = 100; // エコーの遅延時間（ミリ秒）

    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext!)();
    }

    /**
     * エコーキャンセリングを開始
     */
    async start(inputStream: MediaStream, outputStream: MediaStream) {
        if (this.isActive) return;

        try {
            this.inputStream = inputStream;
            this.outputStream = outputStream;

            // 入力音声の設定
            this.inputNode = this.audioContext.createMediaStreamSource(inputStream);
            this.outputNode = this.audioContext.createMediaStreamDestination();

            // ゲインノードの設定
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;

            // ノイズゲートの設定
            this.noiseGateNode = this.audioContext.createGain();
            this.noiseGateNode.gain.value = 0;

            // アナライザーの設定
            this.analyserNode = this.audioContext.createAnalyser();
            this.outputAnalyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 2048;
            this.outputAnalyserNode.fftSize = 2048;

            // 出力音声の監視設定
            const outputSource = this.audioContext.createMediaStreamSource(outputStream);
            outputSource.connect(this.outputAnalyserNode);

            // ノードの接続
            this.inputNode.connect(this.analyserNode);
            this.analyserNode.connect(this.noiseGateNode);
            this.noiseGateNode.connect(this.gainNode);
            this.gainNode.connect(this.outputNode);

            // 音声処理の開始
            this.processAudio();

            this.isActive = true;
        } catch (error) {
            console.error('エコーキャンセリングの開始に失敗:', error);
            throw error;
        }
    }

    /**
     * 音声処理の実行
     */
    private processAudio() {
        if (!this.isActive || !this.analyserNode || !this.outputAnalyserNode) return;

        const inputData = new Uint8Array(this.analyserNode.frequencyBinCount);
        const outputData = new Uint8Array(this.outputAnalyserNode.frequencyBinCount);

        this.analyserNode.getByteFrequencyData(inputData);
        this.outputAnalyserNode.getByteFrequencyData(outputData);

        const inputLevel = this.calculateAverageLevel(inputData);
        const outputLevel = this.calculateAverageLevel(outputData);

        if (outputLevel > 50) {
            this.lastOutputTime = Date.now();
            this.gainNode!.gain.value = 0.1;
            this.noiseGateNode!.gain.value = 0;
        } else {
            const timeSinceLastOutput = Date.now() - this.lastOutputTime;

            if (timeSinceLastOutput > this.echoDelay) {
                if (inputLevel > 30) {
                    this.gainNode!.gain.value = 1.0;
                    this.noiseGateNode!.gain.value = 1.0;
                } else {
                    this.noiseGateNode!.gain.value = 0;
                }
            }
        }

        requestAnimationFrame(() => this.processAudio());
    }

    /**
     * 音声レベルの平均値を計算
     */
    private calculateAverageLevel(data: Uint8Array): number {
        return data.reduce((a, b) => a + b) / data.length;
    }

    /**
     * エコーキャンセリングを停止
     */
    stop() {
        if (!this.isActive) return;

        try {
            if (this.inputNode) this.inputNode.disconnect();
            if (this.gainNode) this.gainNode.disconnect();
            if (this.noiseGateNode) this.noiseGateNode.disconnect();
            if (this.outputNode) this.outputNode.disconnect();
            if (this.analyserNode) this.analyserNode.disconnect();
            if (this.outputAnalyserNode) this.outputAnalyserNode.disconnect();

            if (this.inputStream) {
                this.inputStream.getTracks().forEach(track => track.stop());
            }
            if (this.outputStream) {
                this.outputStream.getTracks().forEach(track => track.stop());
            }

            this.isActive = false;
        } catch (error) {
            console.error('エコーキャンセリングの停止に失敗:', error);
            throw error;
        }
    }

    /**
     * エコーキャンセリングの状態を取得
     */
    isRunning(): boolean {
        return this.isActive;
    }
} 