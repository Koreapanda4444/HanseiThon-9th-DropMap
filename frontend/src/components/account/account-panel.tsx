"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, fetchCurrentAccount, loginAccount, logoutAccount, registerAccount } from "@/lib/api";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "요청을 처리하지 못했습니다.";
}

export function AccountPanel() {
  const queryClient = useQueryClient();
  const accountQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentAccount,
    retry: false,
    staleTime: 60_000,
  });
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const authMutation = useMutation({
    mutationFn: () => mode === "login"
      ? loginAccount({ email, password })
      : registerAccount({ name, email, password }),
    onSuccess: (account) => {
      queryClient.setQueryData(["auth", "me"], account);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      setPassword("");
    },
  });
  const logoutMutation = useMutation({
    mutationFn: logoutAccount,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.removeQueries({ queryKey: ["reports"] });
    },
  });

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    authMutation.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authMutation.mutate();
  }

  if (accountQuery.isPending) {
    return <section id="account" className="h-[170px] animate-pulse rounded-2xl border border-[var(--line)] bg-white" />;
  }

  const account = accountQuery.data;

  return (
    <section id="account" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4">
        <h2 className="text-[15px] font-extrabold text-[var(--ink)]">계정</h2>
        {account && <span className="text-[11px] font-semibold text-[var(--brand-deep)]">로그인됨</span>}
      </div>

      {account ? (
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] font-extrabold text-[var(--brand-deep)]">{account.name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-extrabold text-[var(--ink)]">{account.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--sub)]">{account.email}</p>
            </div>
            <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-[11px] font-bold text-[var(--sub)] hover:bg-[var(--surface-muted)] disabled:opacity-50"><LogOut className="size-3.5" />로그아웃</button>
          </div>
          <Link href="/report" className="mt-4 flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] text-[12px] font-extrabold text-white">내 제보 확인</Link>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 border-b border-[var(--line-soft)] bg-[#fafcfb] p-1">
            {(["login", "register"] as const).map((item) => (
              <button key={item} type="button" onClick={() => changeMode(item)} className={cn("h-9 rounded-md text-[12px] font-bold", mode === item ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--sub)]")}>
                {item === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3 p-5">
            {mode === "register" && (
              <label className="block text-[11px] font-bold text-[var(--sub)]">이름<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={30} required autoComplete="name" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] font-medium text-[var(--ink)] outline-none focus:border-[var(--brand)]" placeholder="이름" /></label>
            )}
            <label className="block text-[11px] font-bold text-[var(--sub)]">이메일<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] font-medium text-[var(--ink)] outline-none focus:border-[var(--brand)]" placeholder="name@example.com" /></label>
            <label className="block text-[11px] font-bold text-[var(--sub)]">비밀번호<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} maxLength={72} required autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] font-medium text-[var(--ink)] outline-none focus:border-[var(--brand)]" placeholder="8자 이상" /></label>
            {authMutation.isError && <p role="alert" className="text-[11px] font-semibold text-rose-600">{errorMessage(authMutation.error)}</p>}
            {accountQuery.isError && <p role="alert" className="text-[11px] font-semibold text-rose-600">계정 정보를 불러오지 못했습니다.</p>}
            <button type="submit" disabled={authMutation.isPending} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] text-[12px] font-extrabold text-white disabled:bg-[#aebbb5]"><UserRound className="size-4" />{authMutation.isPending ? "처리 중" : mode === "login" ? "로그인" : "계정 만들기"}</button>
          </form>
        </div>
      )}
    </section>
  );
}
