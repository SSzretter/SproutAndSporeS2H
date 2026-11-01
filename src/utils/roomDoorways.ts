import { Room, WallSide, RoomDoorLinks } from '../types/sim';

export interface Doorway {
  roomId: string; // target room id, 'ADD_ROOM' or OUTSIDE_DOOR_ID
  label: string;
  side: WallSide;
  isReturn?: boolean;
}

export const ALL_WALL_SIDES: WallSide[] = ['left', 'right', 'back', 'front'];

/** Every room keeps one exterior door to the outdoors, on a wall that isn't linked to another room. */
export const OUTSIDE_DOOR_ID = 'OUTSIDE';
// The hub layout links other rooms right, back, then left, so the left wall stays free longest.
// New rooms are only ever added through green Add Room walls, so the exterior door never moves.
const OUTSIDE_DOOR_PREFERENCE: WallSide[] = ['left', 'back', 'right', 'front']; // front last: it stands between the camera and the room

/**
 * Returns the complementary opposite wall side for return passages:
 * left <-> right, back <-> front
 */
export function getOppositeWall(side: WallSide): WallSide {
  switch (side) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'back':
      return 'front';
    case 'front':
      return 'back';
  }
}

export function getWallDisplayName(side: WallSide): string {
  switch (side) {
    case 'left':
      return 'Left (West) Wall';
    case 'right':
      return 'Right (East) Wall';
    case 'back':
      return 'Back (North) Wall';
    case 'front':
      return 'Front (South) Wall';
  }
}

/**
 * Auto-populates initial door links between rooms if they were created before
 * explicit door links were tracked, ensuring no rooms become orphaned.
 */
export function ensureRoomDoorLinks(allRooms: Room[]): Room[] {
  if (allRooms.length <= 1) return allRooms;

  // Check if any room has doors already set
  const anyHasDoors = allRooms.some(r => r.doors && Object.keys(r.doors).length > 0);
  if (anyHasDoors) return allRooms;

  // Auto-connect rooms in a clean spatial star/hub layout from the primary room
  const [hub, ...others] = allRooms;
  const hubDoors: RoomDoorLinks = {};
  const updatedOthers = [...others];

  const sides: WallSide[] = ['right', 'back', 'left', 'front'];
  others.forEach((other, idx) => {
    if (idx < sides.length) {
      const side = sides[idx];
      const opp = getOppositeWall(side);
      hubDoors[side] = other.id;
      updatedOthers[idx] = {
        ...other,
        doors: {
          ...(other.doors || {}),
          [opp]: hub.id
        }
      };
    }
  });

  return [
    {
      ...hub,
      doors: hubDoors
    },
    ...updatedOthers
  ];
}

/**
 * Resolves the 4 doorways (1 per wall: left, right, back, front) for a given room:
 * - If linked to a room, yields that room transition door.
 * - If not linked, yields an emerald green 'ADD_ROOM' door!
 * When all 4 walls are linked, there are 0 green doors in that room.
 */
export function resolveRoomDoorways(currentRoom: Room, allRooms: Room[]): Doorway[] {
  // Ensure rooms have links if they exist
  const migratedRooms = ensureRoomDoorLinks(allRooms);
  const active = migratedRooms.find(r => r.id === currentRoom.id) || currentRoom;
  const doors = active.doors || {};
  const isLinked = (side: WallSide) => {
    const id = doors[side];
    return !!id && migratedRooms.some(r => r.id === id && r.id !== active.id);
  };
  // Every room has a way outside: its first unlinked wall gets an exterior door instead of an Add Room portal
  const outsideSide = OUTSIDE_DOOR_PREFERENCE.find(side => !isLinked(side));

  return ALL_WALL_SIDES.map(side => {
    if (side === outsideSide) {
      return { roomId: OUTSIDE_DOOR_ID, label: '🌳 Outside', side, isReturn: false };
    }
    const linkedRoomId = doors[side];
    if (linkedRoomId) {
      const targetRoom = migratedRooms.find(r => r.id === linkedRoomId);
      if (targetRoom) {
        return {
          roomId: targetRoom.id,
          label: targetRoom.name,
          side,
          isReturn: true
        };
      }
    }

    // Wall is unlinked: offer a green Add Room portal!
    return {
      roomId: 'ADD_ROOM',
      label: '➕ New Room',
      side,
      isReturn: false
    };
  });
}

/**
 * Connects two rooms through a specified wall on the source room,
 * and the opposite wall on the target room.
 */
export function connectRooms(
  sourceRoom: Room,
  targetRoom: Room,
  sourceWall: WallSide
): { updatedSource: Room; updatedTarget: Room } {
  const oppWall = getOppositeWall(sourceWall);

  const updatedSource: Room = {
    ...sourceRoom,
    doors: {
      ...(sourceRoom.doors || {}),
      [sourceWall]: targetRoom.id
    }
  };

  const updatedTarget: Room = {
    ...targetRoom,
    doors: {
      ...(targetRoom.doors || {}),
      [oppWall]: sourceRoom.id
    }
  };

  return { updatedSource, updatedTarget };
}

/**
 * Finds the first free wall side in a room that does not have a connected room.
 */
export function findFirstFreeWall(room: Room, allRooms: Room[]): WallSide | null {
  const doorways = resolveRoomDoorways(room, allRooms);
  const free = doorways.find(d => d.roomId === 'ADD_ROOM');
  return free ? free.side : null;
}

/**
 * Calculates player spawn position & facing direction when entering a room from a door wall.
 */
export function getDoorSpawnPoint(room: Room, enteredFromWall: WallSide): { x: number; y: number; facing: number } {
  const { length: L, width: W } = room.dimensions;
  const margin = 2.0;

  switch (enteredFromWall) {
    case 'left':
      // Entered from left wall, facing +X (east)
      return { x: margin, y: W / 2, facing: Math.PI / 2 };
    case 'right':
      // Entered from right wall, facing -X (west)
      return { x: Math.max(margin, L - margin), y: W / 2, facing: -Math.PI / 2 };
    case 'back':
      // Entered from back wall, facing +Z (south)
      return { x: L / 2, y: margin, facing: 0 };
    case 'front':
      // Entered from front wall, facing -Z (north)
      return { x: L / 2, y: Math.max(margin, W - margin), facing: Math.PI };
  }
}
