# Claude Code 전용: PC 회의 녹음 음성 파일을 이 PC에서 받아쓰기 (faster-whisper, 무료·오프라인)
#   python scripts/transcribe.py <음성파일> <출력.txt>
# 출력: "[mm:ss] 문장" 줄 목록. GPU(CUDA)가 있으면 GPU, 없으면 CPU로 실행.
# 처음 한 번: pip install --user faster-whisper nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"
import glob, os, sys, site, time

# pip로 설치한 CUDA 라이브러리(cublas, cudnn) DLL 위치를 찾을 수 있게 등록 (Windows)
for base in site.getsitepackages() + [site.getusersitepackages()]:
    for d in glob.glob(os.path.join(base, "nvidia", "*", "bin")):
        os.add_dll_directory(d)
        os.environ["PATH"] = d + os.pathsep + os.environ["PATH"]

from faster_whisper import WhisperModel
import ctranslate2

src, dst = sys.argv[1], sys.argv[2]
gpu = ctranslate2.get_cuda_device_count() > 0
# 모델: 회사망에서 huggingface.co 가 막혀 있어 직접 복사해 둔 폴더를 쓴다 (git에 올리지 않음)
#   models/faster-whisper-large-v3/ 에 config.json, model.bin, preprocessor_config.json, tokenizer.json, vocabulary.json
here = os.path.dirname(os.path.abspath(__file__))
model_dir = os.environ.get("WHISPER_MODEL") or os.path.join(here, "..", "models", "faster-whisper-large-v3")
if not os.path.isfile(os.path.join(model_dir, "model.bin")):
    sys.exit(f"모델이 없습니다: {os.path.abspath(model_dir)} 에 Systran/faster-whisper-large-v3 파일을 넣어 주세요")
model = WhisperModel(model_dir,device="cuda" if gpu else "cpu", compute_type="float16" if gpu else "int8")

t0 = time.time()
segments, info = model.transcribe(src, language="ko", vad_filter=True, beam_size=5,
                                  condition_on_previous_text=False)
lines = []
for s in segments:
    text = s.text.strip()
    if text:
        m, sec = divmod(int(s.start), 60)
        lines.append(f"[{m:02d}:{sec:02d}] {text}")
with open(dst, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"받아쓰기 완료: {len(lines)}줄, 음성 {info.duration/60:.1f}분, {time.time()-t0:.0f}초 걸림 ({'GPU' if gpu else 'CPU'})")
