"use client";

import { LaptopMinimal, LogOut, Moon, Palette, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ThemeSwitch } from "../theme/theme-switch";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Skeleton } from "../ui/skeleton";

const UserAvatar = ({
  user,
  className,
}: {
  user: { name: string; image: string; email: string };
  className?: string;
}) => {
  return (
    <Avatar className={cn(className)}>
      <AvatarImage alt="avatar" src={user.image} />
      <AvatarFallback>{user.name}</AvatarFallback>
    </Avatar>
  );
};

const AuthButtonSkeleton = () => {
  return <Skeleton className="h-8 w-8 rounded-full" />;
};

export const AuthButton = () => {
  const { theme, setTheme } = useTheme();
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  const themes = useMemo(
    () => [
      { icon: <Sun />, isActive: theme === "light", value: "light" },
      { icon: <Moon />, isActive: theme === "dark", value: "dark" },
      {
        icon: <LaptopMinimal />,
        isActive: theme === "system",
        value: "system",
      },
    ],
    [theme],
  );

  if (isPending) {
    return <AuthButtonSkeleton />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <UserAvatar
          user={{
            name: session?.user?.name as string,
            email: session?.user?.email as string,
            image: session?.user?.image as string,
          }}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="flex flex-col ml-4 gap-1 w-64 text-sm"
      >
        <div className="flex items-center p-2 gap-2">
          <UserAvatar
            user={{
              name: session?.user?.name as string,
              email: session?.user?.email as string,
              image: session?.user?.image as string,
            }}
          />
          <div className="flex flex-col gap-1">
            <span className="font-bold">{session?.user?.name}</span>
            <span className="text-muted-foreground">
              {session?.user?.email}
            </span>
          </div>
        </div>
        <DropdownMenuGroup>
          <DropdownMenuItem className="flex justify-between">
            <div className="flex items-center gap-1.5">
              <Palette />
              <span>切换主题</span>
            </div>
            <div className="flex items-center gap-2 border rounded-full px-0.5 py-0.5">
              {themes.map((theme, index) => (
                <ThemeSwitch
                  key={index}
                  icon={theme.icon}
                  isActive={theme.isActive}
                  onClick={() => setTheme(theme.value)}
                />
              ))}
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleLogout()}>
            <LogOut className="h-4 w-4" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
