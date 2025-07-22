export interface IMessage{
    _id: string;
    roomId: string;
    sender: string;
    text: string;
    sentAt: Date;
}
export interface RoomPageProps {
    roomId: string;
    username: string;
}