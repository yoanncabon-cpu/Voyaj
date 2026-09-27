import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'message_model.freezed.dart';
part 'message_model.g.dart';

@freezed
class MessageModel with _$MessageModel {
  const factory MessageModel({
    required String messageId,
    required String senderId,
    required String recipientId,
    String? text,
    String? imageUrl,
    required DateTime createdAt,
    DateTime? readAt,
  }) = _MessageModel;

  factory MessageModel.fromJson(Map<String, dynamic> json) =>
      _$MessageModelFromJson(json);

  factory MessageModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data()!;
    return MessageModel.fromJson({
      ...data,
      'messageId': doc.id,
      'createdAt': (data['createdAt'] as Timestamp?)?.toDate().toIso8601String()
          ?? DateTime.now().toIso8601String(),
      'readAt': (data['readAt'] as Timestamp?)?.toDate().toIso8601String(),
    });
  }
}

@freezed
class ConversationModel with _$ConversationModel {
  const factory ConversationModel({
    required String conversationId,
    required List<String> participants,
    String? lastMessage,
    DateTime? lastMessageAt,
    // Données de l'autre participant (peuplées par le repository)
    String? otherUserId,
    String? otherUserName,
    String? otherUserPhotoUrl,
    @Default(0) int unreadCount,
  }) = _ConversationModel;

  factory ConversationModel.fromJson(Map<String, dynamic> json) =>
      _$ConversationModelFromJson(json);

  factory ConversationModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data()!;
    return ConversationModel.fromJson({
      ...data,
      'conversationId': doc.id,
      'participants': List<String>.from(data['participants'] ?? []),
      'lastMessageAt':
          (data['lastMessageAt'] as Timestamp?)?.toDate().toIso8601String(),
    });
  }
}
