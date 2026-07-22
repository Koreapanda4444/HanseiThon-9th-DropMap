"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, KeyRound, LogOut, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ApiError,
  changeAccountPassword,
  deleteAccount,
  fetchCurrentAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";
type AccountAction = "password" | "delete" | null;

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "요청을 처리하지 못했습니다.";
}

export function AccountPanel() {
  const queryClient = useQueryClient();
  const accountQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: ({ signal }) => fetchCurrentAccount(signal),
    retry: false,
    staleTime: 60_000,
  });
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [action, setAction] = useState<AccountAction>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const clearSessionState = () => {
    queryClient.setQueryData(["auth", "me"], null);
    queryClient.removeQueries({ queryKey: ["reports"] });
    setAction(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setAccountPassword("");
  };

  const authMutation = useMutation({
    mutationFn: () => mode === "login"
      ? loginAccount({ email, password })
      : registerAccount({ name, email, password }),
    onSuccess: (account) => {
      queryClient.removeQueries({ queryKey: ["reports"] });
      queryClient.setQueryData(["auth", "me"], account);
      setPassword("");
    },
  });
  const logoutMutation = useMutation({ mutationFn: logoutAccount, onSuccess: clearSessionState });
  const passwordMutation = useMutation({
    mutationFn: changeAccountPassword,
    onSuccess: () => {
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });
  const deleteMutation = useMutation({ mutationFn: deleteAccount, onSuccess: clearSessionState });

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    authMutation.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authMutation.mutate();
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setPasswordError("");
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("계정과 제보 내역이 삭제됩니다. 계속할까요?")) return;
    deleteMutation.mutate(accountPassword);
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
        <div>
          <div className="flex items-center gap-3 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] font-extrabold text-[var(--brand-deep)]">{account.name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-extrabold text-[var(--ink)]">{account.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--sub)]">{account.email}</p>
            </div>
          </div>

          <div className="border-t border-[var(--line-soft)]">
            <Link href="/report" className="flex h-12 items-center gap-3 px-5 text-[12px] font-bold text-[var(--ink)] hover:bg-[var(--surface-muted)]"><UserRound className="size-4 text-[var(--brand-deep)]" />내 제보 확인<ChevronRight className="ml-auto size-4 text-[var(--faint)]" /></Link>
            <button type="button" onClick={() => { setAction(action === "password" ? null : "password"); passwordMutation.reset(); }} className="flex h-12 w-full items-center gap-3 border-t border-[var(--line-soft)] px-5 text-[12px] font-bold text-[var(--ink)] hover:bg-[var(--surface-muted)]"><KeyRound className="size-4 text-[var(--sub)]" />비밀번호 변경<ChevronRight className={cn("ml-auto size-4 text-[var(--faint)] transition", action === "password" && "rotate-90")} /></button>
            {action === "password" && (
              <form onSubmit={submitPassword} className="space-y-3 border-t border-[var(--line-soft)] bg-[#fafcfb] p-5">
                <label className="block text-[11px] font-bold text-[var(--sub)]">현재 비밀번호<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" minLength={1} maxLength={128} required autoComplete="current-password" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] outline-none focus:border-[var(--brand)]" /></label>
                <label className="block text-[11px] font-bold text-[var(--sub)]">새 비밀번호<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" minLength={10} maxLength={128} required autoComplete="new-password" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] outline-none focus:border-[var(--brand)]" placeholder="10자 이상" /></label>
                <label className="block text-[11px] font-bold text-[var(--sub)]">새 비밀번호 확인<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" minLength={10} maxLength={128} required autoComplete="new-password" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] outline-none focus:border-[var(--brand)]" /></label>
                {(passwordError || passwordMutation.isError) && <p role="alert" className="text-[11px] font-semibold text-rose-600">{passwordError || errorMessage(passwordMutation.error)}</p>}
                {passwordMutation.isSuccess && <p role="status" className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand-deep)]"><CheckCircle2 className="size-4" />비밀번호를 변경했습니다.</p>}
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setAction(null)} className="h-9 rounded-lg border border-[var(--line)] bg-white px-3 text-[11px] font-bold">취소</button><button type="submit" disabled={passwordMutation.isPending} className="h-9 rounded-lg bg-[var(--brand)] px-4 text-[11px] font-extrabold text-white disabled:opacity-50">변경</button></div>
              </form>
            )}
            <button type="button" onClick={() => { setAction(action === "delete" ? null : "delete"); deleteMutation.reset(); }} className="flex h-12 w-full items-center gap-3 border-t border-[var(--line-soft)] px-5 text-[12px] font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" />회원 탈퇴<ChevronRight className={cn("ml-auto size-4 transition", action === "delete" && "rotate-90")} /></button>
            {action === "delete" && (
              <form onSubmit={submitDelete} className="border-t border-rose-100 bg-rose-50/50 p-5">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-extrabold text-rose-700">계정을 삭제합니다</p><p className="mt-1 text-[10px] leading-4 text-rose-600">저장된 계정 정보와 제보 내역은 복구할 수 없습니다.</p></div><button type="button" onClick={() => setAction(null)} aria-label="닫기" className="grid size-7 place-items-center text-rose-500"><X className="size-4" /></button></div>
                <input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} type="password" minLength={1} maxLength={128} required autoComplete="current-password" className="mt-3 h-10 w-full rounded-lg border border-rose-200 bg-white px-3 text-[13px] outline-none focus:border-rose-500" placeholder="현재 비밀번호" aria-label="회원 탈퇴 비밀번호" />
                {deleteMutation.isError && <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-600">{errorMessage(deleteMutation.error)}</p>}
                <button type="submit" disabled={deleteMutation.isPending} className="mt-3 h-9 w-full rounded-lg bg-rose-600 text-[11px] font-extrabold text-white disabled:opacity-50">{deleteMutation.isPending ? "삭제 중" : "계정 삭제"}</button>
              </form>
            )}
            <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="flex h-12 w-full items-center gap-3 border-t border-[var(--line-soft)] px-5 text-[12px] font-bold text-[var(--sub)] hover:bg-[var(--surface-muted)] disabled:opacity-50"><LogOut className="size-4" />로그아웃</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 border-b border-[var(--line-soft)] bg-[#fafcfb] p-1">
            {(["login", "register"] as const).map((item) => (
              <button key={item} type="button" onClick={() => changeMode(item)} className={cn("h-9 rounded-md text-[12px] font-bold", mode === item ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--sub)]")}>{item === "login" ? "로그인" : "회원가입"}</button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3 p-5">
            {mode === "register" && <label className="block text-[11px] font-bold text-[var(--sub)]">이름<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={30} required autoComplete="name" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] font-medium text-[var(--ink)] outline-none focus:border-[var(--brand)]" placeholder="이름" /></label>}
            <label className="block text-[11px] font-bold text-[var(--sub)]">이메일<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] font-medium text-[var(--ink)] outline-none focus:border-[var(--brand)]" placeholder="name@example.com" /></label>
            <label className="block text-[11px] font-bold text-[var(--sub)]">비밀번호<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={mode === "login" ? 1 : 10} maxLength={128} required autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] font-medium text-[var(--ink)] outline-none focus:border-[var(--brand)]" placeholder={mode === "login" ? "비밀번호" : "10자 이상"} /></label>
            {authMutation.isError && <p role="alert" className="text-[11px] font-semibold text-rose-600">{errorMessage(authMutation.error)}</p>}
            {accountQuery.isError && <p role="alert" className="text-[11px] font-semibold text-rose-600">계정 정보를 불러오지 못했습니다.</p>}
            <button type="submit" disabled={authMutation.isPending} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] text-[12px] font-extrabold text-white disabled:bg-[#aebbb5]"><UserRound className="size-4" />{authMutation.isPending ? "처리 중" : mode === "login" ? "로그인" : "계정 만들기"}</button>
          </form>
        </div>
      )}
    </section>
  );
}
