import {Schema, model, models} from "mongoose";

const MessageSchema = new Schema(
    {
        roomId: {
            type: String,
            required: true,
        },
        sender: {
            type: String,
            required: true,
        },
        text: {
            type: String,
            required: true,
        },
    },
    { timestamps:{
        createdAt: 'sentAt',
    }}
);

const Message = models.Message || model("Message", MessageSchema);
export default Message;