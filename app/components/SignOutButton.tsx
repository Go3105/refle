import { signOutAction } from "../lib/actions";

interface SignOutButtonProps {
    className?: string;
}

export function SignOutButton({ className = "" }: SignOutButtonProps) {
    return (
        <form action={signOutAction} className={className}>
            <button className="bg-white hover:bg-gray-100 text-orange-400 px-4 py-2 rounded transition-colors duration-200">
                サインアウト
            </button>
        </form>
    );
}

