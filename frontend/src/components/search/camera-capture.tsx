"use client";

import { Camera, CameraOff, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function CameraCapture({ onClose, onCapture }: {
  onClose: () => void;
  onCapture: (file: File) => Promise<boolean>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let active = true;
    stopCamera();

    async function startCamera() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("카메라는 HTTPS 또는 localhost에서 사용할 수 있습니다.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (videoRef.current.readyState >= 2) setReady(true);
        }
      } catch (cameraError) {
        if (!active) return;
        stopCamera();
        const denied = cameraError instanceof DOMException && cameraError.name === "NotAllowedError";
        setError(denied ? "카메라 권한을 허용해 주세요." : "카메라를 시작하지 못했습니다.");
      }
    }

    void startCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [facingMode, stopCamera]);

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || capturing) return;
    setCapturing(true);
    setError("");
    try {
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("CAMERA_CANVAS_UNAVAILABLE");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("CAMERA_CAPTURE_FAILED")), "image/jpeg", 0.9);
      });
      const accepted = await onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      if (!accepted) setError("촬영한 사진을 불러오지 못했습니다.");
    } catch {
      setError("사진을 촬영하지 못했습니다.");
    } finally {
      setCapturing(false);
    }
  }

  function changeCamera() {
    setReady(false);
    setError("");
    setFacingMode((mode) => mode === "environment" ? "user" : "environment");
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#111513] text-white" role="dialog" aria-modal="true" aria-label="카메라 촬영">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div><h2 className="text-[13px] font-extrabold">사진 촬영</h2><p className="mt-0.5 text-[9px] text-white/55">물품이 화면 안에 들어오도록 맞춰 주세요.</p></div>
        <button type="button" onClick={onClose} aria-label="카메라 닫기" className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-4.5" /></button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video ref={videoRef} muted playsInline autoPlay onLoadedData={() => setReady(true)} className={cn("size-full object-cover transition-opacity", ready ? "opacity-100" : "opacity-0", facingMode === "user" && "-scale-x-100")} />
        {!ready && !error && <div className="absolute inset-0 grid place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-[var(--brand)]" /><p className="mt-3 text-[11px] font-bold text-white/70">카메라를 준비하고 있습니다.</p></div></div>}
        {error && <div className="absolute inset-0 grid place-items-center px-6"><div className="max-w-sm text-center"><CameraOff className="mx-auto size-8 text-white/50" /><p className="mt-4 text-[13px] font-bold">{error}</p><p className="mt-2 text-[10px] leading-5 text-white/55">브라우저 주소창의 카메라 권한을 확인한 뒤 다시 시도해 주세요.</p></div></div>}
        <div className="pointer-events-none absolute inset-[9%] rounded-3xl border border-white/30" />
      </div>

      <footer className="grid h-24 shrink-0 grid-cols-[1fr_88px_1fr] items-center border-t border-white/10 px-5">
        <span />
        <button type="button" onClick={takePhoto} disabled={!ready || capturing} aria-label="촬영" className="mx-auto grid size-[68px] place-items-center rounded-full border-4 border-white bg-white/15 disabled:opacity-40"><span className="grid size-12 place-items-center rounded-full bg-white text-[#17211e]">{capturing ? <LoaderCircle className="size-5 animate-spin" /> : <Camera className="size-5" />}</span></button>
        <button type="button" onClick={changeCamera} disabled={capturing} className="ml-auto flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[10px] font-extrabold disabled:opacity-40"><RefreshCw className="size-3.5" />카메라 전환</button>
      </footer>
    </div>
  );
}
