"use client";

import { X, Moon, Sun, Type, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    highContrast: boolean;
    fontSize: number;
    screenReader: boolean;
  };
  onSettingsChange: (settings: {
    highContrast: boolean;
    fontSize: number;
    screenReader: boolean;
  }) => void;
}

export function SettingsPanel({ isOpen, onClose, settings, onSettingsChange }: SettingsPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div 
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* 패널 */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-xl z-50 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">접근성 설정</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
            <span className="sr-only">닫기</span>
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* 고대비 모드 */}
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
                  고대비 모드
                </Label>
                <p className="text-xs text-muted-foreground">
                  시각적 대비를 높여 가독성 향상
                </p>
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

          {/* 글꼴 크기 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
                <Type className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <Label className="text-sm font-medium">글꼴 크기</Label>
                <p className="text-xs text-muted-foreground">
                  텍스트 크기 조절 ({settings.fontSize}%)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 pl-13">
              <span className="text-xs text-muted-foreground w-6">작게</span>
              <Slider
                value={[settings.fontSize]}
                onValueChange={([value]) =>
                  onSettingsChange({ ...settings, fontSize: value })
                }
                min={80}
                max={150}
                step={10}
                className="flex-1"
                aria-label="글꼴 크기 조절"
              />
              <span className="text-xs text-muted-foreground w-6">크게</span>
            </div>
            <div 
              className="p-3 rounded-lg bg-secondary text-center"
              style={{ fontSize: `${settings.fontSize}%` }}
            >
              <p className="text-foreground">미리보기 텍스트입니다</p>
            </div>
          </div>

          {/* 스크린리더 최적화 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
                <Volume2 className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <Label htmlFor="screen-reader" className="text-sm font-medium">
                  스크린리더 최적화
                </Label>
                <p className="text-xs text-muted-foreground">
                  음성 안내 지원 강화
                </p>
              </div>
            </div>
            <Switch
              id="screen-reader"
              checked={settings.screenReader}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, screenReader: checked })
              }
            />
          </div>

          {/* 안내 메시지 */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-foreground">
              설정은 자동으로 저장되며, 다음 방문 시에도 유지됩니다.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
