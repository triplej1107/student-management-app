import { notFound } from "next/navigation";
import type { Role } from "@/lib/types";
import LoginForm from "@/components/LoginForm";

const ROLE_META: Record<
  Role,
  { roleLabel: string; idLabel?: string; idPlaceholder?: string; hasPassword: boolean }
> = {
  student: {
    roleLabel: "학생",
    idLabel: "학번",
    idPlaceholder: "학원 출입시 등원/하원번호 다섯 자리",
    hasPassword: false,
  },
  parent: {
    roleLabel: "학부모",
    idLabel: "학부모 전화번호",
    idPlaceholder: "예: 01012345678",
    hasPassword: false,
  },
  staff: {
    roleLabel: "조교",
    idLabel: "아이디",
    idPlaceholder: "아이디 입력",
    hasPassword: true,
  },
  zongju: {
    roleLabel: "종주T",
    hasPassword: true,
  },
};

function isRole(value: string): value is Role {
  return value in ROLE_META;
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!isRole(role)) notFound();

  return <LoginForm role={role} meta={ROLE_META[role]} />;
}
