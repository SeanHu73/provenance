import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SEED_PINS } from "../lib/seed-data";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const pinsRef = collection(db, "pins");
    const snapshot = await getDocs(pinsRef);

    if (!snapshot.empty) {
      return NextResponse.json(
        { message: `Already seeded — ${snapshot.size} pins exist.` },
        { status: 200 }
      );
    }

    const results = [];
    for (const pin of SEED_PINS) {
      const { createdAt, ...rest } = pin;
      const docRef = await addDoc(pinsRef, {
        ...rest,
        createdAt: serverTimestamp(),
      });
      results.push({ id: docRef.id, title: pin.title });
    }

    return NextResponse.json(
      { message: `Seeded ${results.length} pins.`, pins: results },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
