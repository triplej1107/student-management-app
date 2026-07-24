import "server-only";
import bcrypt from "bcryptjs";
import { supabase } from "./supabase";

export interface LoginResult {
  ok: boolean;
  error?: string;
  studentId?: number;
  staffId?: number;
}

export async function verifyStudentLogin(studentCode: string): Promise<LoginResult> {
  const code = studentCode.trim();
  if (!code) return { ok: false, error: "학번을 입력해주세요." };

  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("student_code", code)
    .maybeSingle();

  if (error) return { ok: false, error: "로그인 중 오류가 발생했어요. 다시 시도해주세요." };
  if (!data) return { ok: false, error: "일치하는 학번을 찾을 수 없어요. 다시 확인해주세요." };
  return { ok: true, studentId: data.id };
}

export async function verifyParentLogin(phone: string): Promise<LoginResult> {
  const norm = phone.replace(/\D/g, "");
  if (!norm) return { ok: false, error: "학부모 전화번호를 입력해주세요." };

  const { data, error } = await supabase.from("students").select("id, parent_phone");
  if (error) return { ok: false, error: "로그인 중 오류가 발생했어요. 다시 시도해주세요." };

  const found = data?.find((s) => (s.parent_phone ?? "").replace(/\D/g, "") === norm);
  if (!found) return { ok: false, error: "일치하는 학부모 번호를 찾을 수 없어요. 다시 확인해주세요." };
  return { ok: true, studentId: found.id };
}

export async function verifyStaffLogin(
  username: string,
  password: string
): Promise<LoginResult> {
  const uname = username.trim();
  if (!uname || !password) {
    return { ok: false, error: "아이디와 비밀번호를 입력해주세요." };
  }

  const { data, error } = await supabase
    .from("staff")
    .select("id, password_hash")
    .eq("username", uname)
    .maybeSingle();

  if (error) return { ok: false, error: "로그인 중 오류가 발생했어요. 다시 시도해주세요." };
  if (!data) return { ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." };

  const match = await bcrypt.compare(password, data.password_hash);
  if (!match) return { ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  return { ok: true, staffId: data.id };
}

export async function verifyZongjuLogin(password: string): Promise<LoginResult> {
  if (!password) return { ok: false, error: "비밀번호를 입력해주세요." };

  const { data, error } = await supabase
    .from("admin_config")
    .select("password_hash")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "로그인 중 오류가 발생했어요. 다시 시도해주세요." };

  const match = await bcrypt.compare(password, data.password_hash);
  if (!match) return { ok: false, error: "비밀번호가 올바르지 않습니다." };
  return { ok: true };
}
