"use client";

import { useState } from "react";
import { z } from "zod";
import type { SummaryDelta } from "@/components/finance/summary-card";
import { SourceBadge, type SourceBadgeData } from "@/components/finance/source-badge";
import { SummaryCard } from "@/components/finance/summary-card";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DateInput } from "@/components/forms/date-input";
import { Form, TextField } from "@/components/forms/form-field";
import { MoneyInput } from "@/components/forms/money-input";
import { notify } from "@/components/forms/notify";
import { ResponsiveDialog } from "@/components/forms/responsive-dialog";
import { SelectField, type SelectOption } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { SwitchField } from "@/components/forms/switch-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { useAppForm } from "@/components/forms/use-app-form";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import { SlowLoading } from "@/components/states/slow-loading";
import { Button } from "@/components/ui/button";

/**
 * Exemplos interativos do catálogo (precisam de estado ou de callbacks, que não podem sair de
 * Server Components). Uso exclusivo do catálogo.
 */
const noop = () => {};

export function ErrorStateDemo({ scope }: { scope: "page" | "block" }) {
  const [tries, setTries] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <ErrorState scope={scope} onRetry={() => setTries((n) => n + 1)} />
      {tries > 0 && (
        <p className="text-sm text-foreground-muted">Tentativas neste exemplo: {tries}</p>
      )}
    </div>
  );
}

export function PartialErrorDemo({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ErrorState scope="block" onRetry={noop} />
      {children}
    </div>
  );
}

export function NoResultsDemo() {
  return <EmptyState variant="no-results" onClearFilters={noop} />;
}

export function SlowLoadingDemo() {
  const [key, setKey] = useState(0);
  return (
    <SlowLoading key={key} thresholdMs={3000} onRetry={() => setKey((k) => k + 1)}>
      <LoadingSkeleton variant="list" rows={2} />
    </SlowLoading>
  );
}

export function SummaryCardDemo({
  title,
  cents,
  state = "ready",
  delta,
  compact,
  variant,
}: {
  title: string;
  cents: number | null;
  state?: "ready" | "loading" | "error" | "empty";
  delta?: SummaryDelta;
  compact?: boolean;
  variant?: "balance" | "movement" | "neutral";
}) {
  return (
    <SummaryCard
      title={title}
      cents={cents}
      state={state}
      delta={delta}
      compact={compact}
      variant={variant}
      onRetry={noop}
    />
  );
}

export function SourceBadgeDemo(props: SourceBadgeData) {
  return (
    <SourceBadge {...props} onCorrect={() => notify.info("Abriria a correção de categoria.")} />
  );
}

export function ConfirmDialogDemo({ objectName }: { objectName: string }) {
  return (
    <ConfirmDialog
      trigger={<Button variant="destructive">Excluir transação</Button>}
      title={`Excluir transação '${objectName}'?`}
      description="Esta ação não pode ser desfeita."
      confirmLabel="Excluir"
      destructive
      onConfirm={() => notify.undo("Transação excluída.", noop)}
    />
  );
}

export function ResponsiveDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir filtros
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Filtros">
        <p className="text-sm text-foreground-muted">
          No celular abre como painel inferior; no desktop, como diálogo central.
        </p>
      </ResponsiveDialog>
    </>
  );
}

export function NotifyDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => notify.success("Transação salva.")}>
        Sucesso
      </Button>
      <Button variant="secondary" onClick={() => notify.error("Não foi possível salvar.")}>
        Erro
      </Button>
      <Button variant="secondary" onClick={() => notify.info("Sincronização iniciada.")}>
        Informação
      </Button>
      <Button variant="secondary" onClick={() => notify.undo("Transação excluída.", noop)}>
        Com desfazer
      </Button>
    </div>
  );
}

const demoSchema = z.object({
  descricao: z.string().min(1, "Informe a descrição."),
  valor: z.number({ error: "Informe um valor." }).int(),
  data: z.string().min(1, "Informe a data."),
});

/** Formulário completo de exemplo (nada é salvo). */
export function FormDemo({
  direction = "choose",
}: {
  direction?: "income" | "expense" | "choose";
}) {
  const form = useAppForm(demoSchema, { descricao: "", valor: undefined, data: "" });
  return (
    <Form
      form={form}
      onSubmit={async () => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        notify.success("Exemplo enviado (nada foi salvo).");
      }}
      className="max-w-md"
    >
      <TextField name="descricao" label="Descrição" />
      <MoneyInput name="valor" label="Valor" direction={direction} />
      <DateInput name="data" label="Data" />
      <SubmitButton>Salvar</SubmitButton>
    </Form>
  );
}

/** Um campo isolado dentro de um formulário de exemplo. */
export function FieldDemo({
  field,
  options = [],
}: {
  field:
    | "money-expense"
    | "money-income"
    | "money-choose"
    | "date"
    | "select"
    | "switch"
    | "textarea"
    | "text";
  options?: SelectOption[];
}) {
  const form = useAppForm(z.looseObject({}), {});
  return (
    <Form form={form} onSubmit={noop} className="max-w-md">
      {field === "money-expense" && <MoneyInput name="valor" label="Valor" direction="expense" />}
      {field === "money-income" && <MoneyInput name="valor" label="Valor" direction="income" />}
      {field === "money-choose" && <MoneyInput name="valor" label="Valor" direction="choose" />}
      {field === "date" && <DateInput name="data" label="Data" />}
      {field === "select" && <SelectField name="opcao" label="Conta" options={options} />}
      {field === "switch" && (
        <SwitchField name="lembrar" label="Lembrar neste aparelho" help="Exemplo de alternância." />
      )}
      {field === "textarea" && <TextareaField name="nota" label="Observação" maxLength={140} />}
      {field === "text" && (
        <TextField name="descricao" label="Descrição" help="Como aparece no extrato." />
      )}
    </Form>
  );
}
