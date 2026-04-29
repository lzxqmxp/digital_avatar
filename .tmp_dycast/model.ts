import { Long } from './Long';

export interface PushFrame {
  seqId?: string;
  logId?: string;
  service?: string;
  method?: string;
  headersList?: { [key: string]: string };
  payloadEncoding?: string;
  payloadType?: string;
  payload?: Uint8Array;
  lodIdNew?: string;
}

export function encodePushFrame(message: PushFrame): Uint8Array {
  let bb = popByteBuffer();
  _encodePushFrame(message, bb);
  return toUint8Array(bb);
}

function _encodePushFrame(message: PushFrame, bb: ByteBuffer): void {
  // optional uint64 seqId = 1;
  let $seqId = message.seqId;
  if ($seqId !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $seqId);
  }

  // optional uint64 logId = 2;
  let $logId = message.logId;
  if ($logId !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, $logId);
  }

  // optional uint64 service = 3;
  let $service = message.service;
  if ($service !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $service);
  }

  // optional uint64 method = 4;
  let $method = message.method;
  if ($method !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, $method);
  }

  // optional map<string, string> headersList = 5;
  let map$headersList = message.headersList;
  if (map$headersList !== undefined) {
    for (let key in map$headersList) {
      let nested = popByteBuffer();
      let value = map$headersList[key];
      writeVarint32(nested, 10);
      writeString(nested, key);
      writeVarint32(nested, 18);
      writeString(nested, value);
      writeVarint32(bb, 42);
      writeVarint32(bb, nested.offset);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // optional string payloadEncoding = 6;
  let $payloadEncoding = message.payloadEncoding;
  if ($payloadEncoding !== undefined) {
    writeVarint32(bb, 50);
    writeString(bb, $payloadEncoding);
  }

  // optional string payloadType = 7;
  let $payloadType = message.payloadType;
  if ($payloadType !== undefined) {
    writeVarint32(bb, 58);
    writeString(bb, $payloadType);
  }

  // optional bytes payload = 8;
  let $payload = message.payload;
  if ($payload !== undefined) {
    writeVarint32(bb, 66);
    writeVarint32(bb, $payload.length), writeBytes(bb, $payload);
  }

  // optional string lodIdNew = 9;
  let $lodIdNew = message.lodIdNew;
  if ($lodIdNew !== undefined) {
    writeVarint32(bb, 74);
    writeString(bb, $lodIdNew);
  }
}

export function decodePushFrame(binary: Uint8Array): PushFrame {
  return _decodePushFrame(wrapByteBuffer(binary));
}

function _decodePushFrame(bb: ByteBuffer): PushFrame {
  let message: PushFrame = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional uint64 seqId = 1;
      case 1: {
        message.seqId = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 logId = 2;
      case 2: {
        message.logId = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 service = 3;
      case 3: {
        message.service = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional uint64 method = 4;
      case 4: {
        message.method = readVarint64(bb, /* unsigned */ true);
        break;
      }

      // optional map<string, string> headersList = 5;
      case 5: {
        let values = message.headersList || (message.headersList = {});
        let outerLimit = pushTemporaryLength(bb);
        let key: string | undefined;
        let value: string | undefined;
        end_of_entry: while (!isAtEnd(bb)) {
          let tag = readVarint32(bb);
          switch (tag >>> 3) {
            case 0:
              break end_of_entry;
            case 1: {
              key = readString(bb, readVarint32(bb));
              break;
            }
            case 2: {
              value = readString(bb, readVarint32(bb));
              break;
            }
            default:
              skipUnknownField(bb, tag & 7);
          }
        }
        if (key === undefined || value === undefined) throw new Error('Invalid data for map: headersList');
        values[key] = value;
        bb.limit = outerLimit;
        break;
      }

      // optional string payloadEncoding = 6;
      case 6: {
        message.payloadEncoding = readString(bb, readVarint32(bb));
        break;
      }

      // optional string payloadType = 7;
      case 7: {
        message.payloadType = readString(bb, readVarint32(bb));
        break;
      }

      // optional bytes payload = 8;
      case 8: {
        message.payload = readBytes(bb, readVarint32(bb));
        break;
      }

      // optional string lodIdNew = 9;
      case 9: {
        message.lodIdNew = readString(bb, readVarint32(bb));
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Response {
  messages?: Message[];
  cursor?: string;
  fetchInterval?: string;
  now?: string;
  internalExt?: string;
  fetchType?: number;
  routeParams?: { [key: string]: string };
  heartbeatDuration?: string;
  needAck?: boolean;
  pushServer?: string;
  liveCursor?: string;
  historyNoMore?: boolean;
  proxyServer?: string;
}

export function encodeResponse(message: Response): Uint8Array {
  let bb = popByteBuffer();
  _encodeResponse(message, bb);
  return toUint8Array(bb);
}

function _encodeResponse(message: Response, bb: ByteBuffer): void {
  // repeated Message messages = 1;
  let array$messages = message.messages;
  if (array$messages !== undefined) {
    for (let value of array$messages) {
      writeVarint32(bb, 10);
      let nested = popByteBuffer();
      _encodeMessage(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // optional string cursor = 2;
  let $cursor = message.cursor;
  if ($cursor !== undefined) {
    writeVarint32(bb, 18);
    writeString(bb, $cursor);
  }

  // optional int64 fetchInterval = 3;
  let $fetchInterval = message.fetchInterval;
  if ($fetchInterval !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $fetchInterval);
  }

  // optional int64 now = 4;
  let $now = message.now;
  if ($now !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, $now);
  }

  // optional string internalExt = 5;
  let $internalExt = message.internalExt;
  if ($internalExt !== undefined) {
    writeVarint32(bb, 42);
    writeString(bb, $internalExt);
  }

  // optional int32 fetchType = 6;
  let $fetchType = message.fetchType;
  if ($fetchType !== undefined) {
    writeVarint32(bb, 48);
    writeVarint64(bb, intToLong($fetchType));
  }

  // optional map<string, string> routeParams = 7;
  let map$routeParams = message.routeParams;
  if (map$routeParams !== undefined) {
    for (let key in map$routeParams) {
      let nested = popByteBuffer();
      let value = map$routeParams[key];
      writeVarint32(nested, 10);
      writeString(nested, key);
      writeVarint32(nested, 18);
      writeString(nested, value);
      writeVarint32(bb, 58);
      writeVarint32(bb, nested.offset);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // optional int64 heartbeatDuration = 8;
  let $heartbeatDuration = message.heartbeatDuration;
  if ($heartbeatDuration !== undefined) {
    writeVarint32(bb, 64);
    writeVarint64(bb, $heartbeatDuration);
  }

  // optional bool needAck = 9;
  let $needAck = message.needAck;
  if ($needAck !== undefined) {
    writeVarint32(bb, 72);
    writeByte(bb, $needAck ? 1 : 0);
  }

  // optional string pushServer = 10;
  let $pushServer = message.pushServer;
  if ($pushServer !== undefined) {
    writeVarint32(bb, 82);
    writeString(bb, $pushServer);
  }

  // optional string liveCursor = 11;
  let $liveCursor = message.liveCursor;
  if ($liveCursor !== undefined) {
    writeVarint32(bb, 90);
    writeString(bb, $liveCursor);
  }

  // optional bool historyNoMore = 12;
  let $historyNoMore = message.historyNoMore;
  if ($historyNoMore !== undefined) {
    writeVarint32(bb, 96);
    writeByte(bb, $historyNoMore ? 1 : 0);
  }

  // optional string proxyServer = 13;
  let $proxyServer = message.proxyServer;
  if ($proxyServer !== undefined) {
    writeVarint32(bb, 106);
    writeString(bb, $proxyServer);
  }
}

export function decodeResponse(binary: Uint8Array): Response {
  return _decodeResponse(wrapByteBuffer(binary));
}

function _decodeResponse(bb: ByteBuffer): Response {
  let message: Response = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // repeated Message messages = 1;
      case 1: {
        let limit = pushTemporaryLength(bb);
        let values = message.messages || (message.messages = []);
        values.push(_decodeMessage(bb));
        bb.limit = limit;
        break;
      }

      // optional string cursor = 2;
      case 2: {
        message.cursor = readString(bb, readVarint32(bb));
        break;
      }

      // optional int64 fetchInterval = 3;
      case 3: {
        message.fetchInterval = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 now = 4;
      case 4: {
        message.now = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional string internalExt = 5;
      case 5: {
        message.internalExt = readString(bb, readVarint32(bb));
        break;
      }

      // optional int32 fetchType = 6;
      case 6: {
        message.fetchType = readVarint32(bb);
        break;
      }

      // optional map<string, string> routeParams = 7;
      case 7: {
        let values = message.routeParams || (message.routeParams = {});
        let outerLimit = pushTemporaryLength(bb);
        let key: string | undefined;
        let value: string | undefined;
        end_of_entry: while (!isAtEnd(bb)) {
          let tag = readVarint32(bb);
          switch (tag >>> 3) {
            case 0:
              break end_of_entry;
            case 1: {
              key = readString(bb, readVarint32(bb));
              break;
            }
            case 2: {
              value = readString(bb, readVarint32(bb));
              break;
            }
            default:
              skipUnknownField(bb, tag & 7);
          }
        }
        if (key === undefined || value === undefined) throw new Error('Invalid data for map: routeParams');
        values[key] = value;
        bb.limit = outerLimit;
        break;
      }

      // optional int64 heartbeatDuration = 8;
      case 8: {
        message.heartbeatDuration = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional bool needAck = 9;
      case 9: {
        message.needAck = !!readByte(bb);
        break;
      }

      // optional string pushServer = 10;
      case 10: {
        message.pushServer = readString(bb, readVarint32(bb));
        break;
      }

      // optional string liveCursor = 11;
      case 11: {
        message.liveCursor = readString(bb, readVarint32(bb));
        break;
      }

      // optional bool historyNoMore = 12;
      case 12: {
        message.historyNoMore = !!readByte(bb);
        break;
      }

      // optional string proxyServer = 13;
      case 13: {
        message.proxyServer = readString(bb, readVarint32(bb));
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Message {
  method?: string;
  payload?: Uint8Array;
  msgId?: string;
  msgType?: number;
  offset?: string;
  needWrdsStore?: boolean;
  wrdsVersion?: string;
  wrdsSubKey?: string;
}

export function encodeMessage(message: Message): Uint8Array {
  let bb = popByteBuffer();
  _encodeMessage(message, bb);
  return toUint8Array(bb);
}

function _encodeMessage(message: Message, bb: ByteBuffer): void {
  // optional string method = 1;
  let $method = message.method;
  if ($method !== undefined) {
    writeVarint32(bb, 10);
    writeString(bb, $method);
  }

  // optional bytes payload = 2;
  let $payload = message.payload;
  if ($payload !== undefined) {
    writeVarint32(bb, 18);
    writeVarint32(bb, $payload.length), writeBytes(bb, $payload);
  }

  // optional int64 msgId = 3;
  let $msgId = message.msgId;
  if ($msgId !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $msgId);
  }

  // optional int32 msgType = 4;
  let $msgType = message.msgType;
  if ($msgType !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, intToLong($msgType));
  }

  // optional int64 offset = 5;
  let $offset = message.offset;
  if ($offset !== undefined) {
    writeVarint32(bb, 40);
    writeVarint64(bb, $offset);
  }

  // optional bool needWrdsStore = 6;
  let $needWrdsStore = message.needWrdsStore;
  if ($needWrdsStore !== undefined) {
    writeVarint32(bb, 48);
    writeByte(bb, $needWrdsStore ? 1 : 0);
  }

  // optional int64 wrdsVersion = 7;
  let $wrdsVersion = message.wrdsVersion;
  if ($wrdsVersion !== undefined) {
    writeVarint32(bb, 56);
    writeVarint64(bb, $wrdsVersion);
  }

  // optional string wrdsSubKey = 8;
  let $wrdsSubKey = message.wrdsSubKey;
  if ($wrdsSubKey !== undefined) {
    writeVarint32(bb, 66);
    writeString(bb, $wrdsSubKey);
  }
}

export function decodeMessage(binary: Uint8Array): Message {
  return _decodeMessage(wrapByteBuffer(binary));
}

function _decodeMessage(bb: ByteBuffer): Message {
  let message: Message = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional string method = 1;
      case 1: {
        message.method = readString(bb, readVarint32(bb));
        break;
      }

      // optional bytes payload = 2;
      case 2: {
        message.payload = readBytes(bb, readVarint32(bb));
        break;
      }

      // optional int64 msgId = 3;
      case 3: {
        message.msgId = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int32 msgType = 4;
      case 4: {
        message.msgType = readVarint32(bb);
        break;
      }

      // optional int64 offset = 5;
      case 5: {
        message.offset = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional bool needWrdsStore = 6;
      case 6: {
        message.needWrdsStore = !!readByte(bb);
        break;
      }

      // optional int64 wrdsVersion = 7;
      case 7: {
        message.wrdsVersion = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional string wrdsSubKey = 8;
      case 8: {
        message.wrdsSubKey = readString(bb, readVarint32(bb));
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface ChatMessage {
  common?: Common;
  user?: User;
  content?: string;
  visibleToSender?: boolean;
  backgroundImage?: Image;
  fullScreenTextColor?: string;
  backgroundImageV2?: Image;
  publicAreaCommon?: PublicAreaCommon;
  giftImage?: Image;
  agreeMsgId?: string;
  priorityLevel?: number;
  landscapeAreaCommon?: LandscapeAreaCommon;
  eventTime?: string;
  sendReview?: boolean;
  fromIntercom?: boolean;
  intercomHideUserCard?: boolean;
  chatTags?: number;
  chatBy?: string;
  individualChatPriority?: number;
  rtfContent?: Text;
  rtfContentV2?: Text;
}

export function encodeChatMessage(message: ChatMessage): Uint8Array {
  let bb = popByteBuffer();
  _encodeChatMessage(message, bb);
  return toUint8Array(bb);
}

function _encodeChatMessage(message: ChatMessage, bb: ByteBuffer): void {
  // optional Common common = 1;
  let $common = message.common;
  if ($common !== undefined) {
    writeVarint32(bb, 10);
    let nested = popByteBuffer();
    _encodeCommon($common, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional User user = 2;
  let $user = message.user;
  if ($user !== undefined) {
    writeVarint32(bb, 18);
    let nested = popByteBuffer();
    _encodeUser($user, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional string content = 3;
  let $content = message.content;
  if ($content !== undefined) {
    writeVarint32(bb, 26);
    writeString(bb, $content);
  }

  // optional bool visibleToSender = 4;
  let $visibleToSender = message.visibleToSender;
  if ($visibleToSender !== undefined) {
    writeVarint32(bb, 32);
    writeByte(bb, $visibleToSender ? 1 : 0);
  }

  // optional Image backgroundImage = 5;
  let $backgroundImage = message.backgroundImage;
  if ($backgroundImage !== undefined) {
    writeVarint32(bb, 42);
    let nested = popByteBuffer();
    _encodeImage($backgroundImage, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional string fullScreenTextColor = 6;
  let $fullScreenTextColor = message.fullScreenTextColor;
  if ($fullScreenTextColor !== undefined) {
    writeVarint32(bb, 50);
    writeString(bb, $fullScreenTextColor);
  }

  // optional Image backgroundImageV2 = 7;
  let $backgroundImageV2 = message.backgroundImageV2;
  if ($backgroundImageV2 !== undefined) {
    writeVarint32(bb, 58);
    let nested = popByteBuffer();
    _encodeImage($backgroundImageV2, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional PublicAreaCommon publicAreaCommon = 9;
  let $publicAreaCommon = message.publicAreaCommon;
  if ($publicAreaCommon !== undefined) {
    writeVarint32(bb, 74);
    let nested = popByteBuffer();
    _encodePublicAreaCommon($publicAreaCommon, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional Image giftImage = 10;
  let $giftImage = message.giftImage;
  if ($giftImage !== undefined) {
    writeVarint32(bb, 82);
    let nested = popByteBuffer();
    _encodeImage($giftImage, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional int64 agreeMsgId = 11;
  let $agreeMsgId = message.agreeMsgId;
  if ($agreeMsgId !== undefined) {
    writeVarint32(bb, 88);
    writeVarint64(bb, $agreeMsgId);
  }

  // optional int32 priorityLevel = 12;
  let $priorityLevel = message.priorityLevel;
  if ($priorityLevel !== undefined) {
    writeVarint32(bb, 96);
    writeVarint64(bb, intToLong($priorityLevel));
  }

  // optional LandscapeAreaCommon landscapeAreaCommon = 13;
  let $landscapeAreaCommon = message.landscapeAreaCommon;
  if ($landscapeAreaCommon !== undefined) {
    writeVarint32(bb, 106);
    let nested = popByteBuffer();
    _encodeLandscapeAreaCommon($landscapeAreaCommon, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional int64 eventTime = 15;
  let $eventTime = message.eventTime;
  if ($eventTime !== undefined) {
    writeVarint32(bb, 120);
    writeVarint64(bb, $eventTime);
  }

  // optional bool sendReview = 16;
  let $sendReview = message.sendReview;
  if ($sendReview !== undefined) {
    writeVarint32(bb, 128);
    writeByte(bb, $sendReview ? 1 : 0);
  }

  // optional bool fromIntercom = 17;
  let $fromIntercom = message.fromIntercom;
  if ($fromIntercom !== undefined) {
    writeVarint32(bb, 136);
    writeByte(bb, $fromIntercom ? 1 : 0);
  }

  // optional bool intercomHideUserCard = 18;
  let $intercomHideUserCard = message.intercomHideUserCard;
  if ($intercomHideUserCard !== undefined) {
    writeVarint32(bb, 144);
    writeByte(bb, $intercomHideUserCard ? 1 : 0);
  }

  // optional int32 chatTags = 19;
  let $chatTags = message.chatTags;
  if ($chatTags !== undefined) {
    writeVarint32(bb, 152);
    writeVarint64(bb, intToLong($chatTags));
  }

  // optional int64 chatBy = 20;
  let $chatBy = message.chatBy;
  if ($chatBy !== undefined) {
    writeVarint32(bb, 160);
    writeVarint64(bb, $chatBy);
  }

  // optional int32 individualChatPriority = 21;
  let $individualChatPriority = message.individualChatPriority;
  if ($individualChatPriority !== undefined) {
    writeVarint32(bb, 168);
    writeVarint64(bb, intToLong($individualChatPriority));
  }

  // optional Text rtfContent = 40;
  let $rtfContent = message.rtfContent;
  if ($rtfContent !== undefined) {
    writeVarint32(bb, 322);
    let nested = popByteBuffer();
    _encodeText($rtfContent, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional Text rtfContentV2 = 41;
  let $rtfContentV2 = message.rtfContentV2;
  if ($rtfContentV2 !== undefined) {
    writeVarint32(bb, 330);
    let nested = popByteBuffer();
    _encodeText($rtfContentV2, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }
}

export function decodeChatMessage(binary: Uint8Array): ChatMessage {
  return _decodeChatMessage(wrapByteBuffer(binary));
}

function _decodeChatMessage(bb: ByteBuffer): ChatMessage {
  let message: ChatMessage = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional Common common = 1;
      case 1: {
        let limit = pushTemporaryLength(bb);
        message.common = _decodeCommon(bb);
        bb.limit = limit;
        break;
      }

      // optional User user = 2;
      case 2: {
        let limit = pushTemporaryLength(bb);
        message.user = _decodeUser(bb);
        bb.limit = limit;
        break;
      }

      // optional string content = 3;
      case 3: {
        message.content = readString(bb, readVarint32(bb));
        break;
      }

      // optional bool visibleToSender = 4;
      case 4: {
        message.visibleToSender = !!readByte(bb);
        break;
      }

      // optional Image backgroundImage = 5;
      case 5: {
        let limit = pushTemporaryLength(bb);
        message.backgroundImage = _decodeImage(bb);
        bb.limit = limit;
        break;
      }

      // optional string fullScreenTextColor = 6;
      case 6: {
        message.fullScreenTextColor = readString(bb, readVarint32(bb));
        break;
      }

      // optional Image backgroundImageV2 = 7;
      case 7: {
        let limit = pushTemporaryLength(bb);
        message.backgroundImageV2 = _decodeImage(bb);
        bb.limit = limit;
        break;
      }

      // optional PublicAreaCommon publicAreaCommon = 9;
      case 9: {
        let limit = pushTemporaryLength(bb);
        message.publicAreaCommon = _decodePublicAreaCommon(bb);
        bb.limit = limit;
        break;
      }

      // optional Image giftImage = 10;
      case 10: {
        let limit = pushTemporaryLength(bb);
        message.giftImage = _decodeImage(bb);
        bb.limit = limit;
        break;
      }

      // optional int64 agreeMsgId = 11;
      case 11: {
        message.agreeMsgId = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int32 priorityLevel = 12;
      case 12: {
        message.priorityLevel = readVarint32(bb);
        break;
      }

      // optional LandscapeAreaCommon landscapeAreaCommon = 13;
      case 13: {
        let limit = pushTemporaryLength(bb);
        message.landscapeAreaCommon = _decodeLandscapeAreaCommon(bb);
        bb.limit = limit;
        break;
      }

      // optional int64 eventTime = 15;
      case 15: {
        message.eventTime = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional bool sendReview = 16;
      case 16: {
        message.sendReview = !!readByte(bb);
        break;
      }

      // optional bool fromIntercom = 17;
      case 17: {
        message.fromIntercom = !!readByte(bb);
        break;
      }

      // optional bool intercomHideUserCard = 18;
      case 18: {
        message.intercomHideUserCard = !!readByte(bb);
        break;
      }

      // optional int32 chatTags = 19;
      case 19: {
        message.chatTags = readVarint32(bb);
        break;
      }

      // optional int64 chatBy = 20;
      case 20: {
        message.chatBy = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int32 individualChatPriority = 21;
      case 21: {
        message.individualChatPriority = readVarint32(bb);
        break;
      }

      // optional Text rtfContent = 40;
      case 40: {
        let limit = pushTemporaryLength(bb);
        message.rtfContent = _decodeText(bb);
        bb.limit = limit;
        break;
      }

      // optional Text rtfContentV2 = 41;
      case 41: {
        let limit = pushTemporaryLength(bb);
        message.rtfContentV2 = _decodeText(bb);
        bb.limit = limit;
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface EmojiChatMessage {
  common?: Common;
  user?: User;
  emojiId?: string;
  emojiContent?: Text;
  defaultContent?: string;
  backgroundImage?: Image;
  fromIntercom?: boolean;
  intercomHideUserCard?: boolean;
  publicAreaCommon?: PublicAreaCommon;
}

export function encodeEmojiChatMessage(message: EmojiChatMessage): Uint8Array {
  let bb = popByteBuffer();
  _encodeEmojiChatMessage(message, bb);
  return toUint8Array(bb);
}

function _encodeEmojiChatMessage(message: EmojiChatMessage, bb: ByteBuffer): void {
  // optional Common common = 1;
  let $common = message.common;
  if ($common !== undefined) {
    writeVarint32(bb, 10);
    let nested = popByteBuffer();
    _encodeCommon($common, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional User user = 2;
  let $user = message.user;
  if ($user !== undefined) {
    writeVarint32(bb, 18);
    let nested = popByteBuffer();
    _encodeUser($user, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional int64 emojiId = 3;
  let $emojiId = message.emojiId;
  if ($emojiId !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $emojiId);
  }

  // optional Text emojiContent = 4;
  let $emojiContent = message.emojiContent;
  if ($emojiContent !== undefined) {
    writeVarint32(bb, 34);
    let nested = popByteBuffer();
    _encodeText($emojiContent, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional string defaultContent = 5;
  let $defaultContent = message.defaultContent;
  if ($defaultContent !== undefined) {
    writeVarint32(bb, 42);
    writeString(bb, $defaultContent);
  }

  // optional Image backgroundImage = 6;
  let $backgroundImage = message.backgroundImage;
  if ($backgroundImage !== undefined) {
    writeVarint32(bb, 50);
    let nested = popByteBuffer();
    _encodeImage($backgroundImage, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional bool fromIntercom = 7;
  let $fromIntercom = message.fromIntercom;
  if ($fromIntercom !== undefined) {
    writeVarint32(bb, 56);
    writeByte(bb, $fromIntercom ? 1 : 0);
  }

  // optional bool intercomHideUserCard = 8;
  let $intercomHideUserCard = message.intercomHideUserCard;
  if ($intercomHideUserCard !== undefined) {
    writeVarint32(bb, 64);
    writeByte(bb, $intercomHideUserCard ? 1 : 0);
  }

  // optional PublicAreaCommon publicAreaCommon = 9;
  let $publicAreaCommon = message.publicAreaCommon;
  if ($publicAreaCommon !== undefined) {
    writeVarint32(bb, 74);
    let nested = popByteBuffer();
    _encodePublicAreaCommon($publicAreaCommon, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }
}

export function decodeEmojiChatMessage(binary: Uint8Array): EmojiChatMessage {
  return _decodeEmojiChatMessage(wrapByteBuffer(binary));
}

function _decodeEmojiChatMessage(bb: ByteBuffer): EmojiChatMessage {
  let message: EmojiChatMessage = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional Common common = 1;
      case 1: {
        let limit = pushTemporaryLength(bb);
        message.common = _decodeCommon(bb);
        bb.limit = limit;
        break;
      }

      // optional User user = 2;
      case 2: {
        let limit = pushTemporaryLength(bb);
        message.user = _decodeUser(bb);
        bb.limit = limit;
        break;
      }

      // optional int64 emojiId = 3;
      case 3: {
        message.emojiId = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional Text emojiContent = 4;
      case 4: {
        let limit = pushTemporaryLength(bb);
        message.emojiContent = _decodeText(bb);
        bb.limit = limit;
        break;
      }

      // optional string defaultContent = 5;
      case 5: {
        message.defaultContent = readString(bb, readVarint32(bb));
        break;
      }

      // optional Image backgroundImage = 6;
      case 6: {
        let limit = pushTemporaryLength(bb);
        message.backgroundImage = _decodeImage(bb);
        bb.limit = limit;
        break;
      }

      // optional bool fromIntercom = 7;
      case 7: {
        message.fromIntercom = !!readByte(bb);
        break;
      }

      // optional bool intercomHideUserCard = 8;
      case 8: {
        message.intercomHideUserCard = !!readByte(bb);
        break;
      }

      // optional PublicAreaCommon publicAreaCommon = 9;
      case 9: {
        let limit = pushTemporaryLength(bb);
        message.publicAreaCommon = _decodePublicAreaCommon(bb);
        bb.limit = limit;
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface RoomUserSeqMessage {
  common?: Common;
  ranks?: RoomUserSeqMessage_Contributor[];
  total?: string;
  popStr?: string;
  seats?: RoomUserSeqMessage_Contributor[];
  popularity?: string;
  totalUser?: string;
  totalUserStr?: string;
  totalStr?: string;
  onlineUserForAnchor?: string;
  totalPvForAnchor?: string;
  upRightStatsStr?: string;
  upRightStatsStrComplete?: string;
}

export function encodeRoomUserSeqMessage(message: RoomUserSeqMessage): Uint8Array {
  let bb = popByteBuffer();
  _encodeRoomUserSeqMessage(message, bb);
  return toUint8Array(bb);
}

function _encodeRoomUserSeqMessage(message: RoomUserSeqMessage, bb: ByteBuffer): void {
  // optional Common common = 1;
  let $common = message.common;
  if ($common !== undefined) {
    writeVarint32(bb, 10);
    let nested = popByteBuffer();
    _encodeCommon($common, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // repeated RoomUserSeqMessage_Contributor ranks = 2;
  let array$ranks = message.ranks;
  if (array$ranks !== undefined) {
    for (let value of array$ranks) {
      writeVarint32(bb, 18);
      let nested = popByteBuffer();
      _encodeRoomUserSeqMessage_Contributor(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // optional int64 total = 3;
  let $total = message.total;
  if ($total !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $total);
  }

  // optional string popStr = 4;
  let $popStr = message.popStr;
  if ($popStr !== undefined) {
    writeVarint32(bb, 34);
    writeString(bb, $popStr);
  }

  // repeated RoomUserSeqMessage_Contributor seats = 5;
  let array$seats = message.seats;
  if (array$seats !== undefined) {
    for (let value of array$seats) {
      writeVarint32(bb, 42);
      let nested = popByteBuffer();
      _encodeRoomUserSeqMessage_Contributor(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }

  // optional int64 popularity = 6;
  let $popularity = message.popularity;
  if ($popularity !== undefined) {
    writeVarint32(bb, 48);
    writeVarint64(bb, $popularity);
  }

  // optional int64 totalUser = 7;
  let $totalUser = message.totalUser;
  if ($totalUser !== undefined) {
    writeVarint32(bb, 56);
    writeVarint64(bb, $totalUser);
  }

  // optional string totalUserStr = 8;
  let $totalUserStr = message.totalUserStr;
  if ($totalUserStr !== undefined) {
    writeVarint32(bb, 66);
    writeString(bb, $totalUserStr);
  }

  // optional string totalStr = 9;
  let $totalStr = message.totalStr;
  if ($totalStr !== undefined) {
    writeVarint32(bb, 74);
    writeString(bb, $totalStr);
  }

  // optional string onlineUserForAnchor = 10;
  let $onlineUserForAnchor = message.onlineUserForAnchor;
  if ($onlineUserForAnchor !== undefined) {
    writeVarint32(bb, 82);
    writeString(bb, $onlineUserForAnchor);
  }

  // optional string totalPvForAnchor = 11;
  let $totalPvForAnchor = message.totalPvForAnchor;
  if ($totalPvForAnchor !== undefined) {
    writeVarint32(bb, 90);
    writeString(bb, $totalPvForAnchor);
  }

  // optional string upRightStatsStr = 12;
  let $upRightStatsStr = message.upRightStatsStr;
  if ($upRightStatsStr !== undefined) {
    writeVarint32(bb, 98);
    writeString(bb, $upRightStatsStr);
  }

  // optional string upRightStatsStrComplete = 13;
  let $upRightStatsStrComplete = message.upRightStatsStrComplete;
  if ($upRightStatsStrComplete !== undefined) {
    writeVarint32(bb, 106);
    writeString(bb, $upRightStatsStrComplete);
  }
}

export function decodeRoomUserSeqMessage(binary: Uint8Array): RoomUserSeqMessage {
  return _decodeRoomUserSeqMessage(wrapByteBuffer(binary));
}

function _decodeRoomUserSeqMessage(bb: ByteBuffer): RoomUserSeqMessage {
  let message: RoomUserSeqMessage = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional Common common = 1;
      case 1: {
        let limit = pushTemporaryLength(bb);
        message.common = _decodeCommon(bb);
        bb.limit = limit;
        break;
      }

      // repeated RoomUserSeqMessage_Contributor ranks = 2;
      case 2: {
        let limit = pushTemporaryLength(bb);
        let values = message.ranks || (message.ranks = []);
        values.push(_decodeRoomUserSeqMessage_Contributor(bb));
        bb.limit = limit;
        break;
      }

      // optional int64 total = 3;
      case 3: {
        message.total = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional string popStr = 4;
      case 4: {
        message.popStr = readString(bb, readVarint32(bb));
        break;
      }

      // repeated RoomUserSeqMessage_Contributor seats = 5;
      case 5: {
        let limit = pushTemporaryLength(bb);
        let values = message.seats || (message.seats = []);
        values.push(_decodeRoomUserSeqMessage_Contributor(bb));
        bb.limit = limit;
        break;
      }

      // optional int64 popularity = 6;
      case 6: {
        message.popularity = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 totalUser = 7;
      case 7: {
        message.totalUser = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional string totalUserStr = 8;
      case 8: {
        message.totalUserStr = readString(bb, readVarint32(bb));
        break;
      }

      // optional string totalStr = 9;
      case 9: {
        message.totalStr = readString(bb, readVarint32(bb));
        break;
      }

      // optional string onlineUserForAnchor = 10;
      case 10: {
        message.onlineUserForAnchor = readString(bb, readVarint32(bb));
        break;
      }

      // optional string totalPvForAnchor = 11;
      case 11: {
        message.totalPvForAnchor = readString(bb, readVarint32(bb));
        break;
      }

      // optional string upRightStatsStr = 12;
      case 12: {
        message.upRightStatsStr = readString(bb, readVarint32(bb));
        break;
      }

      // optional string upRightStatsStrComplete = 13;
      case 13: {
        message.upRightStatsStrComplete = readString(bb, readVarint32(bb));
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface RoomUserSeqMessage_Contributor {
  score?: string;
  user?: User;
  rank?: string;
  delta?: string;
  isHidden?: boolean;
  scoreDescription?: string;
  exactlyScore?: string;
}

export function encodeRoomUserSeqMessage_Contributor(message: RoomUserSeqMessage_Contributor): Uint8Array {
  let bb = popByteBuffer();
  _encodeRoomUserSeqMessage_Contributor(message, bb);
  return toUint8Array(bb);
}

function _encodeRoomUserSeqMessage_Contributor(message: RoomUserSeqMessage_Contributor, bb: ByteBuffer): void {
  // optional int64 score = 1;
  let $score = message.score;
  if ($score !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, $score);
  }

  // optional User user = 2;
  let $user = message.user;
  if ($user !== undefined) {
    writeVarint32(bb, 18);
    let nested = popByteBuffer();
    _encodeUser($user, nested);
    writeVarint32(bb, nested.limit);
    writeByteBuffer(bb, nested);
    pushByteBuffer(nested);
  }

  // optional int64 rank = 3;
  let $rank = message.rank;
  if ($rank !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, $rank);
  }

  // optional int64 delta = 4;
  let $delta = message.delta;
  if ($delta !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, $delta);
  }

  // optional bool isHidden = 5;
  let $isHidden = message.isHidden;
  if ($isHidden !== undefined) {
    writeVarint32(bb, 40);
    writeByte(bb, $isHidden ? 1 : 0);
  }

  // optional string scoreDescription = 6;
  let $scoreDescription = message.scoreDescription;
  if ($scoreDescription !== undefined) {
    writeVarint32(bb, 50);
    writeString(bb, $scoreDescription);
  }

  // optional string exactlyScore = 7;
  let $exactlyScore = message.exactlyScore;
  if ($exactlyScore !== undefined) {
    writeVarint32(bb, 58);
    writeString(bb, $exactlyScore);
  }
}

export function decodeRoomUserSeqMessage_Contributor(binary: Uint8Array): RoomUserSeqMessage_Contributor {
  return _decodeRoomUserSeqMessage_Contributor(wrapByteBuffer(binary));
}

function _decodeRoomUserSeqMessage_Contributor(bb: ByteBuffer): RoomUserSeqMessage_Contributor {
  let message: RoomUserSeqMessage_Contributor = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional int64 score = 1;
      case 1: {
        message.score = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional User user = 2;
      case 2: {
        let limit = pushTemporaryLength(bb);
        message.user = _decodeUser(bb);
        bb.limit = limit;
        break;
      }

      // optional int64 rank = 3;
      case 3: {
        message.rank = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional int64 delta = 4;
      case 4: {
        message.delta = readVarint64(bb, /* unsigned */ false);
        break;
      }

      // optional bool isHidden = 5;
      case 5: {
        message.isHidden = !!readByte(bb);
        break;
      }

      // optional string scoreDescription = 6;
      case 6: {
        message.scoreDescription = readString(bb, readVarint32(bb));
        break;
      }

      // optional string exactlyScore = 7;
      case 7: {
        message.exactlyScore = readString(bb, readVarint32(bb));
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface GiftMessage {
  common?: Common;
  giftId?: string;
  fanTicketCount?: string;
  groupCount?: string;
  repeatCount?: string;
  comboCount?: string;
  user?: User;
  toUser?: User;
  repeatEnd?: number;
  textEffect?: GiftMessage_TextEffect;
  groupId?: string;
  incomeTaskgifts?: string;
  roomFanTicketCount?: string;
  priority?: GiftIMPriority;
  gift?: GiftStruct;
  logId?: string;
  sendType?: string;
  publicAreaCommon?: PublicAreaCommon;
  trayDisplayText?: Text;
  bannedDisplayEffects?: string;
  trayInfo?: GiftTrayInfo;
  assetEffectMixInfo?: AssetEffectMixInfo;
  displayForSelf?: boolean;
  interactGiftInfo?: string;
  diyItemInfo?: string;
  minAssetSet?: string;
  totalCount?: string;
  clientGiftSource?: number;
  anchorGift?: AnchorGiftData;
  toUserIds?: string;
  sendTime?: string;
  forceDisplayEffects?: string;
  traceId?: string;
  effectDisplayTs?: string;
  sendTogether?: SendTogether;
  extraEffect?: E