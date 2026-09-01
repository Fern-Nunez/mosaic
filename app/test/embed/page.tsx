import GlassShards from "@/components/web/glass/glassShards";

// Scratch harness: three shards scattered over one hero, each with its own
// silhouette and its own colour behind the glass, plus text in front.
export default function EmbedTest() {
  return (
    <main style={{ background: "#171717", minHeight: "100vh" }}>
      <section style={{ position: "relative", height: "90vh", overflow: "hidden" }}>
        {/* Each shard is its own absolutely-positioned box. Move them by
            changing top/left/width/height. is required
            wherever they might overlap. */}
        <div style={{ position: "absolute", top: "5%", left: "6%", width: "34%", height: "45%" }}>
          <GlassShards preset="prism" seed={7} coreColor="#66d9ff" rimColor="#66d9ff" zoom={0.9} />
        </div>

        <div style={{ position: "absolute", top: "38%", right: "8%", width: "30%", height: "50%" }}>
          <GlassShards preset="prism" seed={31} coreColor="#ff7ac2" rimColor="#ff7ac2" zoom={0.7} />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "-6%",
            left: "38%",
            width: "26%",
            height: "42%",
            transform: "rotate(-12deg)",
          }}
        >
          <GlassShards preset="prism" seed={94} coreColor="#9dff7a" rimColor="#9dff7a" zoom={1.2} />
        </div>

        <h1 style={{ position: "relative", zIndex: 1, color: "white", padding: "4rem" }}>
          Rim tinted to match each core
        </h1>
      </section>

      <section style={{ position: "relative", height: "80vh" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <GlassShards preset="prismMosaic" hue={200} />
        </div>
        <h2 style={{ position: "relative", zIndex: 1, color: "white", padding: "3rem" }}>
          Mosaic, palette shifted with hue
        </h2>
      </section>
    </main>
  );
}
