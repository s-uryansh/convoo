export function loadIceConfig(): RTCConfiguration {
  let iceServers: RTCIceServer[] = [];

  try {
    const raw = process.env.NEXT_PUBLIC_ICE_SERVERS_JSON!;
    iceServers = JSON.parse(raw) as RTCIceServer[];
  } catch (err) {
    console.warn("Could not parse ICE_SERVERS_JSON, falling back to Google STUN", err);
    iceServers = [{ urls: ["stun:stun.l.google.com:19302"] }];
  }

  return {
    iceServers,
    iceTransportPolicy: "all",
    bundlePolicy: "balanced",
    rtcpMuxPolicy: "require",
    iceCandidatePoolSize: 0,
  };
}