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
import { Check, Download, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
      <DialogContent
        hideClose
        className="w-[calc(100%-2.5rem)] sm:max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl border-border/60 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.5)]"
      >
        {/* Single close button — focus outline suppressed to avoid the ring artifact */}
        {canDismiss && (
          <button
            onClick={handleLater}
            aria-label="Dismiss"
            className="update-rise absolute right-3.5 top-3.5 z-10 grid place-items-center w-8 h-8 rounded-full text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90 focus:outline-none focus-visible:outline-none"
          >
            <X size={17} strokeWidth={2.25} />
          </button>
        )}

        {/* Header */}
        <DialogHeader className="pr-8 gap-1.5">
          <div
            className={cn(
              "update-pop mx-auto mt-1 grid h-14 w-14 place-items-center rounded-2xl",
              "bg-gradient-to-br from-primary to-[oklch(0.55_0.2_260)] text-primary-foreground",
              "update-float update-glow",
              stage === "downloading" && "animate-pulse",
            )}
          >
            {stage === "verifying" || stage === "installing" ? (
              <Check className="h-6 w-6 update-pop" strokeWidth={2.5} />
            ) : (
              <Download className="h-6 w-6" strokeWidth={2.25} />
            )}
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <DialogTitle className="text-center text-xl leading-tight">{updateInfo.title}</DialogTitle>
            {updateInfo.latestVersionName && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums whitespace-nowrap">
                v{updateInfo.latestVersionName}
              </span>
            )}
          </div>
          {releaseDateFormatted && (
            <DialogDescription className="text-center text-sm">
              Released {releaseDateFormatted}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Description */}
        <div className="space-y-3">
          {updateInfo.description && (
            <p
              className="update-rise text-sm text-muted-foreground text-center"
              style={{ animationDelay: "90ms" }}
            >
              {updateInfo.description}
            </p>
          )}

          {/* Changelog */}
          {updateInfo.changes.length > 0 && (
            <div className="update-rise rounded-xl bg-muted/50 p-4" style={{ animationDelay: "160ms" }}>
              <h4 className="text-sm font-semibold mb-2">What&apos;s New</h4>
              <ul className="space-y-1.5">
                {updateInfo.changes.map((change, i) => (
                  <li
                    key={i}
                    className="update-rise flex items-start gap-2 text-sm text-muted-foreground"
                    style={{ animationDelay: `${220 + i * 70}ms` }}
                  >
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mandatory warning */}
          {isMandatory && (
            <div className="update-rise rounded-lg border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-3">
              <Shield className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Required Update</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This update contains critical improvements. Please update to continue using ChatZ.
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="update-pop rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Progress bar */}
          {(stage === "downloading" || stage === "verifying") && (
            <div className="update-pop space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {stage === "downloading" ? "Downloading update..." : "Verifying integrity..."}
                </span>
                {stage === "downloading" ? (
                  <span className="font-semibold tabular-nums text-primary">{downloadProgress}%</span>
                ) : (
                  <Check className="h-4 w-4 text-primary update-pop" />
                )}
              </div>
              <div className="relative overflow-hidden rounded-full">
                <Progress
                  value={stage === "downloading" ? downloadProgress : 100}
                  className="h-2.5 transition-all duration-300"
                />
                {stage === "downloading" && (
                  <div className="update-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                )}
              </div>
            </div>
          )}

          {/* Installing indicator */}
          {stage === "installing" && (
            <div className="update-pop flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <span
                className="h-4 w-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin"
                role="status"
                aria-label="Installing"
              />
              Launching installer...
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="update-rise mt-1 flex items-center gap-3" style={{ animationDelay: "300ms" }}>
          {isMandatory ? (
            <Button
              onClick={handleUpdate}
              disabled={stage !== "idle"}
              className="flex-1 text-base transition-transform active:scale-[0.97]"
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
              <Button
                variant="outline"
                onClick={handleLater}
                disabled={stage !== "idle"}
                className="flex-1 text-base transition-transform active:scale-[0.97]"
              >
                Later
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={stage !== "idle"}
                className="flex-1 text-base transition-transform active:scale-[0.97]"
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
