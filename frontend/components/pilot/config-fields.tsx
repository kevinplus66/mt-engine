"use client";

import type { ReactNode } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";

interface NumericFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  error?: string;
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export function NumericField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  description,
  error,
}: NumericFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const inputMode = step && step % 1 !== 0 ? "decimal" : "numeric";

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NumberField
        id={`${id}-field`}
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(next) => onChange(next ?? 0)}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput
            id={id}
            name={id}
            autoComplete="off"
            inputMode={inputMode}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
          />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {error && (
        <FieldError id={errorId} match aria-live="polite">
          {error}
        </FieldError>
      )}
    </Field>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: TextFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <FieldError id={errorId} match aria-live="polite">
          {error}
        </FieldError>
      )}
    </Field>
  );
}

export function SectionHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="font-heading text-base">{title}</span>
      {children}
    </div>
  );
}
