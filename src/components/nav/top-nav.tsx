import Image from "next/image";
import { AuthButton } from "../auth/auth-button";

export const TopNav = () => {
  return (
    <div className="flex justify-between items-center px-4 py-2 border-b bg-white dark:bg-black">
      {/* 导航左侧 logo */}
      <div className="flex items-center">
        <Image
          src="/icons/logo.svg"
          alt="logo"
          width={120}
          height={20}
          className="dark:hidden h-12 w-auto"
        />
        <Image
          src="/icons/logo-dark.svg"
          alt="logo"
          width={120}
          height={20}
          className="hidden dark:block h-12 w-auto"
        />
      </div>

      {/* 导航右侧 - 主题色切换/用户头像 */}
      <div className="flex items-center gap-3">
        {/* <ThemeSwitch /> */}

        <div className="hidden sm:flex gap-2 ml-2 hover:bg-muted p-2 rounded-md cursor-pointer">
          <AuthButton />
        </div>
      </div>
    </div>
  );
};
