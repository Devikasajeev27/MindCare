import { Schema, model } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "info" },
    read: { type: Boolean, default: false },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NotificationSchema.post("save", function (doc) {
  if (doc.isNew) {
    import("../services/socketService.ts")
      .then(({ emitNotification }) => {
        emitNotification(String(doc.userId), {
          _id: doc._id,
          title: doc.title,
          message: doc.message,
          type: doc.type,
          read: doc.read,
          createdAt: doc.createdAt,
        });
      })
      .catch(() => {});
  }
});

export const Notification = model("Notification", NotificationSchema);
