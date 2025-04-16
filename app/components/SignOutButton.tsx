import { signOutAction } from "../lib/actions";

interface SignOutButtonProps {
    className?: string;
}

export function SignOutButton({ className = "" }: SignOutButtonProps) {
    return (
        <form action={signOutAction} className={className}>
            <button className="bg-gray-300 hover:bg-black text-black hover:text-white px-4 py-2 rounded transition-colors duration-200">
                サインアウト
            </button>
        </form>
    );
}

