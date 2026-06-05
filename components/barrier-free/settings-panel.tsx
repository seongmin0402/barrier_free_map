"use client";

import { X, Moon, Sun, Type, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { AppLocale, AppSettings } from "@/lib/app-settings";
import { useUi } from "@/hooks/use-ui";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

const LOCALE_OPTIONS: Array<{ value: AppLocale; labelKey: "localeKo" | "localeEn" }> = [
  { value: "ko", labelKey: "localeKo" },
  { value: "en", labelKey: "localeEn" },
];

export function SettingsPanel({ isOpen, onClose, settings, onSettingsChange }: SettingsPanelProps) {
  const ui = useUi();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-xl z-50 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{ui.settings.title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
            <span className="sr-only">{ui.settings.close}</span>
          </Button>
        </div>

        <div className="p-4 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
                <Languages className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <Label className="text-sm font-medium">{ui.settings.language}</Label>
                <p className="text-xs text-muted-foreground">{ui.settings.languageHint}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-13">
              {LOCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, locale: opt.value })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    settings.locale === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-accent",
                  )}
                >
                  {ui.settings[opt.labelKey]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
                {settings.highContrast ? (
                  <Moon className="w-5 h-5 text-foreground" />
                ) : (
                  <Sun className="w-5 h-5 text-foreground" />
                )}
              </div>
              <div>
                <Label htmlFor="high-contrast" className="text-sm font-medium">
                  {ui.settings.highContrast}
                </Label>
                <p className="text-xs text-muted-foreground">{ui.settings.highContrastHint}</p>
              </div>
            </div>
            <Switch
              id="high-contrast"
              checked={settings.highContrast}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, highContrast: checked })
              }
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
                <Type className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <Label className="text-sm font-medium">{ui.settings.fontSize}</Label>
                <p className="text-xs text-muted-foreground">
                  {ui.settings.fontSizeHint(settings.fontSize)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 pl-13">
              <span className="text-xs text-muted-foreground w-6">{ui.settings.fontSm}</span>
              <Slider
                value={[settings.fontSize]}
                onValueChange={([value]) =>
                  onSettingsChange({ ...settings, fontSize: value })
                }
                min={80}
                max={150}
                step={10}
                className="flex-1"
                aria-label={ui.settings.fontSize}
              />
              <span className="text-xs text-muted-foreground w-6">{ui.settings.fontLg}</span>
            </div>
            <div
              className="p-3 rounded-lg bg-secondary text-center"
              style={{ fontSize: `${settings.fontSize}%` }}
            >
              <p className="text-foreground">{ui.settings.preview}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground">{ui.settings.savedHint}</p>
          </div>
        </div>
      </div>
    </>
  );
}
