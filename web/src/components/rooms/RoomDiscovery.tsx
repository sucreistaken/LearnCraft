import React, { useState, useEffect } from "react";
import type { StudyServer } from "../../types";
import { useRoomStore2 } from "../../stores/roomStore2";
import { useAuthStore } from "../../stores/authStore";
import RoomCard from "./RoomCard";

interface Props {
  onSelectRoom: (roomId: string) => void;
}

export default function RoomDiscovery({ onSelectRoom }: Props) {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [results, setResults] = useState<StudyServer[]>([]);
  const [loading, setLoading] = useState(false);
  const discoverRooms = useRoomStore2((s) => s.discoverRooms);
  const joinPublicRoom = useRoomStore2((s) => s.joinPublicRoom);
  const rooms = useRoomStore2((s) => s.rooms);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setLoading(true);
    const tags = tagFilter ? tagFilter.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
    discoverRooms(search || undefined, tags).then((res) => {
      setResults(res);
      setLoading(false);
    });
  }, [search, tagFilter]);

  const handleJoin = async (roomId: string) => {
    if (!user) return;
    await joinPublicRoom(roomId, user.id);
    onSelectRoom(roomId);
  };

  const memberRoomIds = new Set(rooms.map((r) => r.id));

  return (
    <div className="sh-discovery">
      <h2 className="sh-discovery__title">Discover Rooms</h2>
      <div className="sh-discovery__filters">
        <input
          type="text"
          placeholder="Search rooms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sh-discovery__search"
        />
        <input
          type="text"
          placeholder="Filter by tags (comma separated)"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="sh-discovery__search"
        />
      </div>
      <div className="sh-discovery__list">
        {loading && <p className="sh-discovery__loading">Searching...</p>}
        {!loading && results.length === 0 && <p className="sh-discovery__empty">No rooms found</p>}
        {results.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            isMember={memberRoomIds.has(room.id)}
            onJoin={handleJoin}
            onSelect={onSelectRoom}
          />
        ))}
      </div>
    </div>
  );
}
