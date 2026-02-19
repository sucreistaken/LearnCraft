import React from "react";
import { useAuthStore } from "../../stores/authStore";

const AVATARS = [
  "avatar-1", "avatar-2", "avatar-3", "avatar-4",
  "avatar-5", "avatar-6", "avatar-7", "avatar-8",
  "avatar-9", "avatar-10", "avatar-11", "avatar-12",
];

const COLORS = [
  "#5865F2", "#57F287", "#FEE75C", "#EB459E",
  "#ED4245", "#FF7B3A", "#3BA5F4", "#9B59B6",
];

interface Props {
  onSelect?: () => void;
}

export default function AvatarPicker({ onSelect }: Props) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const currentAvatar = user?.profile.avatar || "avatar-1";

  const handleSelect = (avatar: string) => {
    updateProfile({ avatar });
    onSelect?.();
  };

  return (
    <div className="avatar-picker">
      <div className="avatar-grid">
        {AVATARS.map((av) => (
          <button
            key={av}
            className={`avatar-option ${currentAvatar === av ? "avatar-option--active" : ""}`}
            onClick={() => handleSelect(av)}
            type="button"
          >
            <div
              className="avatar-circle"
              style={{ backgroundColor: COLORS[AVATARS.indexOf(av) % COLORS.length] }}
            >
              {av.replace("avatar-", "")}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
