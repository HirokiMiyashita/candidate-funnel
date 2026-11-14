"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Server Action のフォーム用の送信ボタン。
 * 送信中は押せなくし、文言を切り替える（連打による二重送信を防ぐ）。
 */
export function SubmitButton({
  children,
  pendingText = "送信中...",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
