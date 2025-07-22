import { NextResponse } from "next/server";
import {MongoClient} from "mongodb";
import { nanoid } from "nanoid";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri!);
const dbName = process.env.MONGODB_DB_NAME || "convoo";

export async function POST(request: Request) {
    try{
        const { creator } = await request.json();
        if (!creator) {
            return NextResponse.json({ error: "Creator is required" }, { status: 400 });
        }

        await client.connect();
        const db = client.db(dbName);
        const roomsCollection = db.collection("rooms");

        const roomId = nanoid(8);
        const newRoom = {
            roomId,
            creator,
            createdAt: new Date(),
            users: [creator],
        };

        await roomsCollection.insertOne(newRoom);
        return NextResponse.json(
            { roomId },
            { status: 201 }
        );
    }catch (error){
        console.log("Error Creating room: ", error)
    }finally {
        await client.close();
    }

}