import { Alert, Box, Typography } from "@mui/material";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

interface QrCameraReaderProps {
  onDetected: (code: string) => void;
}

export function QrCameraReader({ onDetected }: QrCameraReaderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraError, setHasCameraError] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    const reader = new BrowserQRCodeReader();

    let isActive = true;
    let scannerControls: IScannerControls | undefined;

    async function startScanner(targetVideoElement: HTMLVideoElement) {
      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: {
                ideal: "environment",
              },
            },
          },
          targetVideoElement,
          (result, _error, currentControls) => {
            if (!isActive || !result) {
              return;
            }

            currentControls.stop();
            onDetected(result.getText());
          },
        );

        if (!isActive) {
          controls.stop();
          return;
        }

        scannerControls = controls;
      } catch {
        if (isActive) {
          setHasCameraError(true);
        }
      }
    }

    void startScanner(videoElement);

    return () => {
      isActive = false;
      scannerControls?.stop();
    };
  }, [onDetected]);

  return (
    <Box
      aria-label="Leitor de QR pela câmera"
      sx={{
        bgcolor: "common.black",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <video
        aria-label="Imagem da câmera"
        autoPlay
        muted
        playsInline
        ref={videoRef}
        style={{
          display: "block",
          minHeight: 240,
          objectFit: "cover",
          width: "100%",
        }}
      />

      {hasCameraError && (
        <Alert severity="error" sx={{ m: 2 }}>
          <Typography>
            Não foi possível acessar a câmera. Use a digitação manual do código.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
