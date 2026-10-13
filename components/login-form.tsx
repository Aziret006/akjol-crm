"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorText, Field } from "@/components/ui";
import { DEMO_LOGINS } from "@/lib/seed";
import { useCrm } from "@/lib/store";

const fieldClass =
  "h-10 w-full rounded border border-[#d5dde5] bg-white px-3 text-sm outline-none transition focus:border-[#2e6db4]";

export function LoginForm() {
  const crm = useCrm();
  const router = useRouter();
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:grid lg:grid-cols-[minmax(280px,1fr)_minmax(420px,0.9fr)]">
      <aside className="flex items-center bg-[#1a2332] px-6 py-5 lg:flex-col lg:items-start lg:justify-between lg:px-12 lg:py-10">
        <Image src="/logo-white.svg" alt="Акжол таксопарк" width={148} height={29} priority />
        <div className="hidden max-w-sm lg:block">
          <p className="text-[28px] font-semibold leading-tight text-white">Диспетчерская</p>
          <p className="mt-3 text-sm leading-6 text-white/65">Смены, обращения и переписки в одном окне.</p>
        </div>
        <p className="hidden text-xs text-white/45 lg:block">Акжол таксопарк · Бишкек</p>
      </aside>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <form
          className="w-full max-w-[380px]"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const result = await crm.login(login, password);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.replace("/");
          }}
        >
          <h1 className="text-xl font-semibold">Вход</h1>
          <p className="mt-1 text-sm text-[#828b95]">Логин и пароль сотрудника</p>
          <div className="mt-6 space-y-3">
            <ErrorText>{error}</ErrorText>
            <Field label="Логин">
              <input className={fieldClass} value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required />
            </Field>
            <Field label="Пароль">
              <input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </Field>
            <button
              type="submit"
              disabled={pending || !crm.ready}
              className="mt-1 h-10 w-full rounded bg-[#2e6db4] text-sm font-medium text-white hover:bg-[#245a96] disabled:cursor-not-allowed disabled:bg-[#e8edf2] disabled:text-[#9aa3ad]"
            >
              {pending ? "Вход..." : "Войти"}
            </button>
          </div>

          <div className="mt-8">
            <p className="text-[13px] text-[#828b95]">Демо-аккаунты</p>
            <div className="mt-2 space-y-2">
              {DEMO_LOGINS.map((account) => {
                const selected = login === account.login;
                return (
                  <button
                    key={account.login}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded border px-3 py-2 text-left ${selected ? "border-[#2e6db4] bg-[#f4f8fd]" : "border-[#e3e8ee] hover:bg-[#f7f9fb]"}`}
                    onClick={() => {
                      setLogin(account.login);
                      setPassword(account.password);
                      setError("");
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f2fc] text-[12px] font-medium text-[#1d5fa7]">
                      {account.name[0]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">{account.name}</span>
                      <span className="block text-xs text-[#828b95]">{account.role}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
