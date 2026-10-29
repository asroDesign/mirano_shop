import { AuthPage } from "@/components/AuthPage";

export const metadata = { title: "ساخت حساب کاربری" };

export default function Register() { return <AuthPage initialIntent="register" />; }
