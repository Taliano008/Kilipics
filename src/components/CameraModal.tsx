import React, { useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { mc, mf, ms, mr } from "@/theme/merchant";
import { cameraIcon } from "@/utils/icon-assets";

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPictureTaken: (photo: { uri: string; width: number; height: number }) => void;
}

export function CameraModal({ visible, onClose, onPictureTaken }: CameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isTakingPicture, setIsTakingPicture] = useState(false);

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.permissionContainer}>
          <Text style={s.permissionText}>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.permissionContainer}>
          <Text style={s.permissionText}>We need your permission to show the camera.</Text>
          <TouchableOpacity style={s.grantBtn} onPress={requestPermission}>
            <Text style={s.grantBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const handleCapture = async () => {
    if (cameraRef.current && !isTakingPicture) {
      setIsTakingPicture(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1, // We will compress it later using ImageManipulator
        });
        if (photo) {
          onPictureTaken({
            uri: photo.uri,
            width: photo.width,
            height: photo.height,
          });
        }
      } catch (e) {
        console.error("Failed to take picture:", e);
      } finally {
        setIsTakingPicture(false);
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" ref={cameraRef} />
        <View style={s.overlay}>
          <View style={s.topBar}>
            <TouchableOpacity style={s.closeIconBtn} onPress={onClose}>
              <Text style={s.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={s.bottomBar}>
            <TouchableOpacity
              style={s.captureBtnContainer}
              onPress={handleCapture}
              disabled={isTakingPicture}
            >
              <View style={[s.captureBtn, isTakingPicture && s.captureBtnDisabled]}>
                <Image source={cameraIcon} style={s.captureIcon} tintColor={mc.primary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
  },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: ms.md,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  closeIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIconText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: mf.bold,
  },
  bottomBar: {
    paddingBottom: 50,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtnContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtnDisabled: {
    backgroundColor: "#ccc",
  },
  captureIcon: {
    width: 32,
    height: 32,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mc.surface,
    padding: ms.lg,
  },
  permissionText: {
    fontFamily: mf.medium,
    fontSize: 16,
    color: mc.onSurface,
    textAlign: "center",
    marginBottom: ms.lg,
  },
  grantBtn: {
    backgroundColor: mc.primary,
    paddingHorizontal: ms.xl,
    paddingVertical: ms.sm,
    borderRadius: mr.full,
    marginBottom: ms.md,
  },
  grantBtnText: {
    color: mc.onPrimary,
    fontFamily: mf.bold,
    fontSize: 15,
  },
  closeBtn: {
    padding: ms.sm,
  },
  closeBtnText: {
    color: mc.primary,
    fontFamily: mf.semibold,
    fontSize: 15,
  },
});
