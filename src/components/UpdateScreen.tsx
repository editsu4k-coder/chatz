import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Shield, X } from "lucide-react";
import type { UpdateInfo } from "@/lib/update-repo";

interface UpdateScreenProps {
  open: boolean;
  updateInfo: UpdateInfo;
  onLater?: () => void;
  onUpdate: () => Promise<void>;
}

type UpdateStage = "idle" | "checking_permission" | "downloading" | "verifying" | "installing";

export function UpdateScreen({ open, updateInfo, onLater, onUpdate }: UpdateScreenProps) {
  const [stage, setStage] = useState<UpdateStage>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isMandatory = updateInfo.isMandatory;
  const canDismiss = !isMandatory && stage === "idle";

  async function handleUpdate() {
    try {
      setError(null);
      setStage("checking_permission");

      // Import dynamically to avoid SSR issues
      const { checkInstallPermission, openInstallPermissionSettings, downloadApk, verifyChecksum, installApk } =
        await import("@/lib/update-repo");

      // Check install permission
      const permResult = await checkInstallPermission();
      if (permResult.needsPermission) {
        await openInstallPermissionSettings();
        // Wait for user to return from settings
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Re-check
        const recheck = await checkInstallPermission();
        if (recheck.needsPermission) {
          setError("Install permission required. Please allow installation from unknown sources.");
          setStage("idle");
          return;
        }
      }

      // Download APK
      setStage("downloading");
      setDownloadProgress(0);
      const downloadResult = await downloadApk(updateInfo.downloadUrl, (progress) => {
        setDownloadProgress(progress);
      });

      if (!downloadResult.success || !downloadResult.apkPath) {
        throw new Error(downloadResult.error || "Download failed");
      }

      // Verify checksum
      setStage("verifying");
      const checksumResult = await verifyChecksum(downloadResult.apkPath, updateInfo.sha256);
      if (!checksumResult.valid) {
        throw new Error("APK verification failed. Please try again.");
      }

      // Install
      setStage("installing");
      await installApk(downloadResult.apkPath);

      // If we reach here, install was triggered successfully
      // The app will restart after installation completes
    } catch (err) {
      console.error("Update flow failed:", err);
      setError(err instanceof Error ? err.message : "Update failed");
      setStage("idle");
    }
  }

  function handleLater() {
    if (canDismiss && onLater) {
      onLater();
    }
  }

  // Format release date
  const releaseDateFormatted = updateInfo.releaseDate
    ? new Date(updateInfo.releaseDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Only allow closing if not mandatory and not in progress
      if (!isOpen && canDismiss) {
        handleLater();
      }
    }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl">{updateInfo.title}</DialogTitle>
            {canDismiss && (
              <button
                onClick={handleLater}
                className="rounded-full p-1 hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {releaseDateFormatted && (
            <DialogDescription className="text-sm">
              Released {releaseDateFormatted}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Description */}
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{updateInfo.description}</p>

          {/* Changelog */}
          {updateInfo.changes.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="text-sm font-semibold mb-2">What's New</h4>
              <ul className="space-y-1.5">
                {updateInfo.changes.map((change, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mandatory warning */}
          {isMandatory && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-3">
              <Shield className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Required Update</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This update contains critical improvements. Please update to continue using ChatZ.
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Progress bar */}
          {(stage === "downloading" || stage === "verifying") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {stage === "downloading" ? "Downloading..." : "Verifying..."}
                </span>
                {stage === "downloading" && (
                  <span className="tabular-nums">{downloadProgress}%</span>
                )}
              </div>
              <Progress value={stage === "downloading" ? downloadProgress : 100} className="h-2" />
            </div>
          )}

          {/* Installing indicator */}
          {stage === "installing" && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <span
                className="h-4 w-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin"
                role="status"
                aria-label="Installing"
              />
              Installing update...
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          {isMandatory ? (
            <Button
              onClick={handleUpdate}
              disabled={stage !== "idle"}
              className="flex-1"
              size="lg"
            >
              {stage === "idle" ? (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Update ChatZ
                </>
              ) : stage === "checking_permission" ? (
                "Checking..."
              ) : stage === "downloading" ? (
                "Downloading..."
              ) : stage === "verifying" ? (
                "Verifying..."
              ) : (
                "Installing..."
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleLater} disabled={stage !== "idle"} className="flex-1">
                Later
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={stage !== "idle"}
                className="flex-1"
                size="lg"
              >
                {stage === "idle" ? (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Update Now
                  </>
                ) : stage === "checking_permission" ? (
                  "Checking..."
                ) : stage === "downloading" ? (
                  "Downloading..."
                ) : stage === "verifying" ? (
                  "Verifying..."
                ) : (
                  "Installing..."
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
