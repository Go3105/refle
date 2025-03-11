'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function Search({ placeholder }: { placeholder: string }) {
    //client componetだからuseSearchParamsが使える
    const searchParams = useSearchParams();
    //現在のpathを取得
    const pathname = usePathname();
    const { replace } = useRouter();

    const handleSearch = useDebouncedCallback((term) => {
        //useDebouncedCallbackによってDebounceを有効に
        //Debounce：関数が実行される頻度を制限する手法,ユーザーが一文字ずつ検索バーに入力するごとにパラメータが更新されるのを防ぐ(今回の場合、検索バーへの入力が終わってからパラメータが更新されるようになっている)
        console.log(`Searching... ${term}`);

        const params = new URLSearchParams(searchParams);
        params.set('page', '1');
        if (term) {
            params.set('query', term);
        } else {
            params.delete('query');
        }
        //params.toString()によって、ユーザが検索バーに入力した文字列がURLに反映される
        replace(`${pathname}?${params.toString()}`);
        console.log(term);
    }, 300);

    return (
        <div className="relative flex flex-1 flex-shrink-0">
            <label htmlFor="search" className="sr-only">
                Search
            </label>
            <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                placeholder={placeholder}
                //検索バーに入力されるごとにhandlesearchが呼び出され、URLが変更される
                onChange={(e) => {
                    handleSearch(e.target.value);
                }}
                defaultValue={searchParams.get('query')?.toString()}
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
        </div>
    );
}