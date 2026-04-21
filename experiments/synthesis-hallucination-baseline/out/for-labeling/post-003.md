# Post 003

## Post generado

> Looking at these commits, "concurrency" isn't actually the through-line — the real story is what this engineer built: a content intelligence system that was producing zero posts, and the systematic work to fix that.
> 
> The ADR doc named it plainly. Three problems. The module taxonomy was too narrow — no "general engineering" detection, so the system returned nothing. Events state lived outside Supabase, burning API calls on every run. No in-memory SHA dedup meant the same commit could get enriched N times per run.
> 
> But fixing detection logic alone isn't enough if your extraction layer is fragile. So Puppeteer fallback got hardened behind a config-driven host list — discord.com, stripe.com, others — with match strength tracking baked into the DB schema. Protected sources got their own handling path. The extraction pipeline now knows the difference between "couldn't fetch" and "fetched but weak."
> 
> Then came the corpus work. Seventy-five-plus curated articles seeded by hand, each with topic tags, quality scores, author attribution, and editorial notes explaining *why* they're worth surfacing — not just that they are. Concurrency in Elixir, causal ordering failures in Remix, free-threaded Python, Go pipeline design at Cloudflare, trace propagation across Elixir message passing without blowing up telemetry costs. The corpus isn't random. It's the ground truth the system learns signal from.
> 
> Phase 3 swapped compressed Haiku extraction for statistical voice-moves measurement with stage-based example selection. A probabilistic dice mechanism controls when generation context gets injected.
> 
> This is what a system going from "produces ~0 posts" to actually working looks like. Not one fix. A layered rebuild.
> 
> #lilicurl #codingWithHumor

## Commits de origen

### Commit 1: 320ce9f
**Message:** feat: expand seed corpus with systems batch

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index 032ebff..48d2031 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -80,3 +80,10 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 79,track2,ai_assisted,"performance,architecture_patterns",https://engineering.fb.com/2026/04/02/developer-tools/kernelevolve-how-metas-ranking-engineer-agent-optimizes-ai-infrastructure/,"KernelEvolve: How Meta’s Ranking Engineer Agent Optimizes AI Infrastructure","Engineering at Meta","Meta Engineering",2026-04-02,9,"High-signal AI systems post on treating kernel optimization as a search problem with closed-loop evaluation, distributed benchmarking, and production throughput wins.",kept,,
 80,track2,performance,"design_patterns,architecture_patterns",https://engineering.fb.com/2025/10/06/developer-tools/openzl-open-source-format-aware-compression-framework/,"Introducing OpenZL: An Open Source Format-Aware Compression Framework","Engineering at Meta","Meta Engineering",2025-10-06,8,"A solid systems article on separating a universal decoder from trainable compression plans to balance operational simplicity with format-specific performance.",kept,,
 81,track2,ai_assisted,"dx,clean_code",https://github.blog/ai-and-ml/github-copilot/agent-driven-development-in-copilot-applied-science/,"Agent-driven development in Copilot Applied Science","The GitHub Blog","Tyler McGoffin",2026-03-31,8,"A practical agent-development article on guardrails, docs, tests, and process design when coding agents become first-class collaborators on a real team.",kept,,
+82,track2,go_patterns,"design_patterns,performance",https://blog.cloudflare.com/building-jetflow-a-framework-for-flexible-performant-data-pipelines-at-cloudflare/,"Building Jetflow: a framework for flexible, performant data pipelines at Cloudflare","Cloudflare Blog","Harry Hough; Rebecca Walton-Jones; Andy Fan; Ricardo Margalhau; Uday Sharma",2025-07-23,9,"A rich Go-and-systems article on staged pipeline design, Arrow-based memory layout, idempotent partitions, and major throughput gains at Cloudflare scale.",kept,,
+83,track2,elixir_patterns,"observability,concurrency",https://discord.com/blog/tracing-discords-elixir-systems-without-melting-everything,"Tracing Discord's Elixir Systems (Without Melting Everything)","Discord Engineering","Nick Krichevsky",2026-03-04,9,"Excellent observability write-up on propagating trace context across Elixir message passing and sampling fanout-heavy workloads without blowing up telemetry costs.",kept,,
+84,track2,design_patterns,"security,dx",https://discord.com/blog/osprey-open-sourcing-our-rule-engine,"Osprey: Open Sourcing our Rule Engine","Discord Engineering","Jared Miller; Ayu",2026-02-19,9,"Strong design-patterns article on building a rule engine around declarative rules, UDFs, distributed workers, and investigator-facing feedback loops.",kept,,
+85,track2,java_patterns,"architecture_patterns,performance",https://quarkus.io/blog/mmaler-blogpost-2-quarkus-runtime-and-framework-for-cloud-native-java/,"Quarkus: A Runtime and Framework for Cloud-Native Java","Quarkus Blog","Michal Mickey Maléř",2025-11-27,8,"A solid platform article that explains Quarkus as both framework and runtime, with build-time optimization, extension architecture, and concrete production tradeoffs.",kept,,
+86,track2,java_patterns,"complexity,performance",https://quarkus.io/blog/leyden-1/,"How Project Leyden brought a new perspective","Quarkus Blog","Guillaume Smet",2026-02-24,8,"A useful Java performance deep dive showing how Leyden exposed hidden startup costs and led to practical optimizations across the Quarkus stack.",kept,,
+87,track2,dependency_health,"security,observability",https://github.blog/security/supply-chain-security/a-year-of-open-source-vulnerability-trends-cves-advisories-and-malware/,"A year of open source vulnerability trends: CVEs, advisories, and malware","The GitHub Blog","Jonathan Evans",2026-03-26,8,"A strong supply-chain article with concrete data on advisory volume, malware trends, and what maintainers should actually triage in the open-source vulnerability stream.",kept,,
+88,track2,js_advanced,"architecture_patterns,dx",https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/,"Your frontend, backend, and database — now in one Cloudflare Worker","Cloudflare Blog","Korinne Alpers",2025-04-08,8,"A practical JavaScript platform article on collapsing frontend, backend, and data layers into Workers while keeping performance and deploy ergonomics under control.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index e66f267..b4ccfc7 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -969,5 +969,89 @@
       "dx",
       "clean_code"
     ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/building-jetflow-a-framework-for-flexible-performant-data-pipelines-at-cloudflare/",
+    "title": "Building Jetflow: a framework for flexible, performant data pipelines at Cloudflare",
+    "source_name": "Cloudflare Blog",
+    "text": "2025-07-23 9 min read This post is also available in \u7b80\u4f53\u4e2d\u6587 and \u65e5\u672c\u8a9e . The Cloudflare Business Intelligence team manages a petabyte -scale data lake and ingests thousands of tables every day from many different sources. These include internal databases such as Postgres and ClickHouse, as well as external SaaS applications such as Salesforce. These tasks are often complex and tables may have hundreds of millions or billions of rows of new data each day. They are also business-critical for product decisions, growth plannings, and internal monitoring. In total, about 141 billion rows are ingested every day. As Cloudflare has grown, the data has become ever larger and more complex. Our existing Extract Load Transform (ELT) solution could no longer meet our technical and business requirements. After evaluating other common ELT solutions, we concluded that their performance generally did not surpass our current system, either. It became clear that we needed to build our own framework to cope with our unique requirements \u2014 and so Jetflow was born. What we achieved Over 100x efficiency improvement in GB-s : Our longest running job with 19 billion rows was taking 48 hours using 300 GB of memory , and now completes in 5.5 hours using 4 GB of memory We estimate that ingestion of 50 TB from Postgres via Jetflow could cost under $100 based on rates published by commercial cloud providers >10x performance improvement: Our largest dataset was ingesting 60-80,000 rows per second, this is now 2-5 million rows per second per database connection. In addition, these numbers scale well with multiple database connections for some databases. Extensibility: The modular design makes it easy to extend and test . Today Jetflow works with ClickHouse, Postgres, Kafka, many different SaaS APIs, Google BigQuery and many others. It has continued to work well and remain flexible with the addition of new use cases. How did we do this? Requirements The first step to designing our new framework had to be a clear understanding of the problems we were aiming to solve, with clear requirements to stop us creating new ones. Performant & efficient We needed to be able to move more data in less time as some ingestion jobs were taking ~24 hours, and our data will only grow. The data should be ingested in a streaming fashion and use less memory and compute resources than our existing solution. Backwards compatible Given the daily ingestion of thousands of tables, the chosen solution needed to allow for the migration of individual tables as needed. Due to our usage of Spark downstream and Spark's limitations in merging disparate Parquet schemas, the chosen solution had to offer the flexibility to generate the precise schemas needed for each case to match legacy. We also required seamless integration with our custom metadata system, used for dependency checks and job status information. Ease of use We want a configuration file that can be version-controlled, without introducing bottlenecks on repositories with many concurrent changes. To increase accessibility for different roles within the team, another requirement was no-code (or configuration as code) in the vast majority of cases. Users should not have to worry about availability or translation of data types between source and target systems, or writing new code for each new ingestion. The configuration needed should also be minimal \u2014 for example, data schema should be inferred from the source system and not need to be supplied by the user. Customizable Striking a balance with the no-code requirement above, although we want a low bar of entry we also want to have the option to tune and override options if desired, with a flexible and optional configuration layer. For example, writing Parquet files is often more expensive than reading from the database, so we want to be able to allocate more resources and concurrency as needed. Additionally, we wanted to allow for control over where the work is executed, with the ability to spin up concurrent workers in different threads, different containers, or on different machines. The execution of workers and communication of data was abstracted away with an interface, and different implementations can be written and injected, controlled via the job configuration. Testable We wanted a solution capable of running locally in a containerized environment, which would allow us to write tests for every stage of the pipeline. With \u201cblack box\u201d solutions, testing often means validating the output after making a change, which is a slow feedback loop, risks not testing all edge cases as there isn\u2019t good visibility of all code paths internally, and makes debugging issues painful. Designing a flexible framework To build a truly flexible framework, we broke the pipeline down into distinct stages, and then create a config layer to define the composition of the pipeline from these stages, and any configuration overrides. Every pipeline configuration that makes sense logically should execute correctly, and users should not be able to create pipeline configs that do not work. Pipeline configuration This led us to a design where we created stages which were classified according to the meaningfully different categories of: Consumers Transformers Loaders The pipeline was constructed via a YAML file that required a consumer, zero or more transformers, and at least one loader. Consumers create a data stream (via reading from the source system), Transformers (e.g. data transformations, validations) take a data stream input and output a data stream conforming to the same API so that they can be chained, and Loaders have the same data streaming interface, but are the stages with persistent effects \u2014 i.e. stages where data is saved to an external system. This modular design means that each stage is independently testable, with shared behaviour (such as error handling and concurrency) inherited from shared base stages, significantly decreasing development time for new use cases and increasing confidence in code correctness. Data divisions Next, we designed a breakdown for the data that would allow the pipeline to be idempotent both on whole pipeline re-run and also on internal retry of any data partition due to transient error. We decided on a design that let us parallelize processing, while maintaining meaningful data divisions that allowed the pipeline to perform cleanups of data where required for a retry. RunInstance : the least granular division, corresponding to a business unit for a single run of the pipeline (e.g. one month/day/hour of data). Partition : a division of the RunInstance that allows each row to be allocated to a partition in a way that is deterministic and self-evident from the row data without external state, and is therefore idempotent on retry. (e.g. an accountId range, a 10-minute interval) Batch : a division of the partition data that is non-deterministic and used only to break the data down into smaller chunks for streaming/parallel processing for faster processing with fewer resources. (e.g. 10k rows, 50 MB) The options that the user configures in the consumer stage YAML both construct the query that is used to retrieve the data from the source system, and also encode the semantic meaning of this data division in a system agnostic way, so that later stages understand what this data represents \u2014 e.g. this partition contains the data for all accounts IDs 0-500. This means that we can do targeted data cleanup and avoid, for example, duplicate data entries if a single data partition is retried due to error. Framework implementation Standard internal state for stage compatibility Our most common use case is something like read from a database, convert to Parquet format, and then save to object storage, with each of these steps being a separate stage. As more use cases were onboarded to Jetflow, we had to make sure that if someone wrote a new stage it would be compatible with the other stages. We don\u2019t want to create a situation where new code needs to be written for every output format and target system, or you end up with a custom pipeline for every different use case. The way we have solved this problem is by having our stage extractor class only allow output data in a single format. This means as long as any downstream stages support this format as in the input and output format they would be compatible with the rest of the pipeline. This seems obvious in retrospect, but internally was a painful learning experience, as we originally created a custom type system and struggled with stage interoperability. For this internal format, we chose to use Arrow , an in-memory columnar data format. The key benefits of this format for us are: Arrow ecosystem : Many data projects now support Arrow as an output format. This means when we write extractor stages for new data sources, it is often trivial to produce Arrow output. No serialisation overhead : This makes it easy to move Arrow data between machines and even programming languages with minimum overhead. Jetflow was designed from the start to have the flexibility to be able to run in a wide range of systems via a job controller interface, so this efficiency in data transmission means there\u2019s minimal compromise on performance when creating distributed implementations. Reserve memory in large fixed-size batches to avoid memory allocations : As Go is a garbage collected (GC) language and GC cycle times are affected mostly by the number of objects rather than the sizes of those objects, fewer heap objects reduces CPU time spent garbage collecting significantly, even if the total size is the same. As the number of objects to scan, and possibly collect, during a GC cycle increases with the number of allocations, if we have 8192 rows with 10 columns each, Arrow would only require us to do 10 allocations versus the 8192 allocations of most drivers that allocate on a row by row basis, meaning fewer objects and lower GC cycle times with Arrow. Converting rows to columns Another important performance optimization was reducing the number of conversion steps that happen when reading and processing data. Most data ingestion frameworks internally represent data as rows. In our case, we are mostly writing data in Parquet format, which is column based. When reading data from column-based sources (e.g. ClickHouse, where most drivers receive RowBinary format), converting into row-based memory representations for the specific language implementation is inefficient. This is then converted again from rows to columns to write Parquet files. These conversions result in a significant performance impact. Jetflow instead reads data from column-based sources in columnar formats (e.g. for ClickHouse-native Block format) and then copies this data into Arrow column format. Parquet files are then written directly from Arrow columns. The simplification of this process improves performance. Writing each pipelines stage Case study: ClickHouse When testing an initial version of Jetflow , we discovered that due to the architecture of ClickHouse, using additional connections would not be of any benefit, since ClickHouse was reading faster than we were receiving data. It should then be possible, with a more optimized database driver, to take better advantage of that single connection to read a much larger number of rows per second, without needing additional connections. Initially, a custom database driver was written for ClickHouse, but we ended up switching to the excellent ch-go low level library , which directly reads Blocks from ClickHouse in a columnar format. This had a dramatic effect on performance in comparison to the standard Go driver. Combined with the framework optimisations above, we now ingest millions of rows per second with a single ClickHouse connection. A valuable lesson learned is that as with any software, tradeoffs are often made for the sake of convenience or a common use case that may not match your own. Most database drivers tend not to be optimized for reading large batches of rows, and have high per-row overhead. Case study: Postgres For Postgres, we use the excellent jackc/pgx driver, but instead of using the database/sql Scan interface, we directly receive the raw bytes for each row and use the jackc/pgx internal scan functions for each Postgres OID (Object Identifier) type. The database/sql Scan interface in Go uses reflection to understand the type passed to the function and then also uses reflection to set each field with the column value received from Postgres. In typical scenarios, this is fast enough and easy to use, but falls short for our use cases in terms of performance. The jackc/pgx driver reuses the row bytes produced each time the next Postgres row is requested, resulting in zero allocations per row. This allows us to write high-performance, low-allocation code within Jetflow. With this design, we are able to achieve nearly 600,000 rows per second per Postgres connection for most tables, with very low memory usage. Conclusion As of early July 2025, the team ingests 77 billion records per day via Jetflow . The remaining jobs are in the process of being migrated to Jetflow , which will bring the total daily ingestion to 141 billion records. The framework has allowed us to ingest tables in cases that would not otherwise have been possible, and provided significant cost savings due to ingestions running for less time and with fewer resources. In the future, we plan to open source the project, and if you are interested in joining our team to help develop tools like this, then open roles can be found at https://www.cloudflare.com/careers/jobs/ . Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Data Go Performance Design Engineering",
+    "quality_score": 9,
+    "modules": [
+      "go_patterns",
+      "design_patterns",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/tracing-discords-elixir-systems-without-melting-everything",
+    "title": "Tracing Discord's Elixir Systems (Without Melting Everything)",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers Nick Krichevsky March 4, 2026 At Discord, we want the experience of chatting with your friends, reacting to a message, or posting artisanal farm-to-channel memes to feel instantaneous. We\u2019ve managed to achieve this at scale by leveraging Elixir\u2019s powerful concurrency mechanisms to run each Discord server (which we call a \u201cguild\u201d internally) fully independently from one another. Sometimes though, things go wrong, and a guild can\u2019t keep up with its user activity. When this happens, the guild will feel laggy or possibly experience a complete outage. If the system degrades beyond the point it can self-heal, an on-call engineer has to intervene. Afterwards, they turn to our observability tools to understand the cause and how to stop it from recurring. Our on-call engineer\u2019s investigation begins by looking at metrics and logs. We have a wide array of instrumentation, including measurements of how frequently we process each user action type and how long processing takes. These often provide useful hints about bursty activity, like a flurry of hype and reactions on that sweet new game that just got shadow-dropped, but even if we find an inciting event, it\u2019s tricky to gauge what the experience was for users. Think of it like your car\u2019s dashboard: it can tell you what the engine temperature is, but not the consequences of it running hot. If that doesn\u2019t yield results, the on-call engineer turns to our custom-built tool called \u201cguild timings.\u201d Every time a guild processes an action, it records how much of the current minute has been spent on each action type to an in-memory store. This data is much more detailed than our metrics, but it\u2019s emitted at such a high volume that we can\u2019t feasibly store it all. As such, this data is rotated frequently for all but our largest guilds. Even if we retrieve the data in time, it still won\u2019t give us a good picture of the end-to-end experience, as it doesn\u2019t capture downstream effects. Other teams at Discord have derived enormous value from utilizing distributed tracing (a.k.a. Application Performance Monitoring), which allows them to see how long the constituent parts of an operation took. Adding tracing to our Elixir stack took a bit of work, though. Most tracing tools work by passing information about the operation via metadata layers like HTTP headers, but Elixir\u2019s built-in communication tools don\u2019t have an equivalent layer out of the box. So\u2026 we had to build our own. Despite the fact that we were changing how our services communicate with one another, we managed to integrate it without downtime. Setting the Stage: Elixir at Discord, and Tracing Elixir, and How it Powers Discord Whenever you do something on Discord, your action turns into a \u201c message \u201d in our Elixir stack, which is then forwarded to connected clients. Elixir programs consist of lightweight processes (scheduled by the runtime, not the OS) that communicate via message passing, making concurrent programming a breeze. This model allows us to trivially distribute our programs across many nodes, too. Processes are the building blocks of Discord\u2019s architecture. Every guild runs as an Elixir process that uses message passing to fan out actions to all connected \u201csessions\u201d; each session is itself an Elixir process that forwards actions to clients. Therefore, when we talk about a user action flowing through the Elixir stack, we\u2019re actually talking about the act of messages being passed between processes. To capture an end-to-end performance story, we needed a solution that allows us to follow a particular message\u2019s path throughout the system, which is precisely what tracing provides us. A Gentle Introduction to Tracing When a user sends a Discord message, their client sends it over HTTP to our API service, which records it in the database and sends it to the Elixir stack via gRPC. As the API service processes the message, its tracing library times each step and records the measurements in a way that lets us visualize how each step affected overall execution. Each region of code timed by a tracing library is called a span . Every time a span starts, the library links it to the currently active one (if any), building a tree of nested spans. This tree forms a trace , which we can use to see a timeline of events during execution. Below is part of a trace from someone sending a message on Discord. As discord_api processed the message, it recorded a span called message_common.dispatch_message that took 1.69 ms. It then sent the message to discord-guilds , which spent 357 \u03bcs fanning it out to discord-sessions . From there, each session recorded its own span while forwarding the message. All these spans linked together form our complete trace! \u200d A trace from Discord\u2019s Python API, with the spans generated from broadcasting (\u201cdispatching\u201d) a user\u2019s message. Note: discord-guilds represents the actual guilds service, while discord_guilds is an RPC client in the API service. While the final structure can look complex, spans are quite simple to record in code. If you\u2019ve ever written code like this, you\u2019ve effectively created spans! def dispatch_message(): start_time = time_ms() # ... print(f\"dispatch_message took {time_ms() - start_time} ms\") A tracing library will handle a lot of the details for you, including managing timers, tracking their results, and even uploading them to your observability provider. Here\u2019s how we\u2019d convert our snippet to use one: def dispatch_message(): start_span(\"dispatch_message\") # ... end_span() Most tracing libraries track the current span and trace in some kind of global state. As new spans are created, the library checks this state and marks the current span as the new span\u2019s parent. This global state is called context, and it is the critical link that allows us to build traces that span multiple services (no pun intended). When discord_api interacts with discord-guilds , it passes an encoded version of the context in the gRPC headers, allowing discord-guilds to link any spans it generates to discord_api 's trace. This technique is extremely powerful. The resulting traces not only show the exact duration of each step, but also how execution flows. For example, the trace shown above shows us that discord-guilds broadcasts the user\u2019s message asynchronously from discord_api \u2019s dispatch_message . This example is pretty obvious from the code, but in other cases, traces can help identify unexpected bottlenecks, like code you expected to run in parallel running serially. Getting Started with Tracing Elixir We decided to use OpenTelemetry\u2019s Erlang/Elixir library to instrument our stack. Adding spans to our Elixir services was relatively straightforward: wrap key operations in calls to with_span , configure the library to report to our observability provider, and we\u2019re done! This gave us spans within a single service, which was extremely useful on its own, but didn't yet give us a clear picture of downstream operations. To gain these end-to-end insights, we had to propagate trace context between services. As mentioned earlier, the API service already passed this context to the guilds service in gRPC headers. Linking with the API service\u2019s spans just required pointing OpenTelemetry at the headers. Easy peasy! Things were less simple for calls between our Elixir services. Elixir processes can send arbitrary messages to each other, but that arbitrary message is all that gets sent. In other words, there\u2019s nowhere to stick metadata, like our trace context, unless it\u2019s a part of the message itself. Capturing all steps of an operation requires that the trace context be attached to every message, but encoding it manually would be unwieldy and error-prone. We needed to develop a new solution. Prototyping potential solutions revealed a few requirements: Sending and receiving messages that include trace context must be ergonomic and require as little additional code as possible. If developers need to think about packing or unpacking the trace context, it won\u2019t be adopted for future code. The solution must work equally well for plain messages and for GenServer operations (a common abstraction over message passing). We use both at Discord. We must be able to integrate the solution into our systems as part of our normal deployment process. Downtime to change the communication mechanism isn\u2019t acceptable, so we need to support toggling it at runtime during rollout. With these requirements in hand, we built Transport: our internal message passing library. It\u2019s an incredibly simple library, so I want to share as much of its design here as possible; buckle in, we\u2019re gonna read some code! Adding Metadata to our Messages with Transport Transport introduces a new primitive to our Elixir stack: the Envelope . Whenever a service sends a message with Transport, the message is wrapped in an Envelope , and any extra metadata is attached to it. This primitive, plus a few small helper functions, gives us exactly what we need to fulfill our three requirements. Transport exposes two functions, wrap_message and handle_message , which will wrap or unwrap a message in an Envelope and handle trace context propagation. Transport provides drop-in replacements for GenServer \u2019s call and cast functions (which provide request-response and fire-and-forget semantics, respectively) that similarly wrap messages before performing the call or cast. An application is free to mix calls to GenServer functions with calls to Transport functions; handle_message will handle messages sent by both. This gave us the freedom to add runtime configuration options to control which mechanism each service used, allowing for a gradual, zero-downtime rollout. Integrating Transport into a service is pretty straightforward. Services add handle_message into their GenServer\u2019s handle_call / handle_cast / handle_info callbacks to automatically unpack Envelope s and extract trace context before proceeding with message handling. Here's what it looks like in the guilds service: defmodule DiscordGuilds.Guild do alias Discord.Transport alias Discord.Transport.Envelope require OpenTelemetry.Tracer use GenServer # ... def handle_call(message, from, state) do Transport.handle_message(message, fn %Envelope{message: message} -> span_name = span_name(:call, message) OpenTelemetry.Tracer.with_span span_name do do_handle_call(message, from, state) end end) end # handle_cast/handle_info follow nearly identical implementations # ... end The Envelope structure powering this API is shockingly uncomplicated. Here\u2019s the entire definition, omitting a couple of bells and whistles we\u2019ve added in for optimizations ( oooooo spooky foreshadowing ). defmodule Discord.Transport.Envelope do @enforce_keys [:message] defstruct [ :message, trace_carrier: [] ] def wrap_message(message) do %__MODULE__{ message: message, # Captures the active context from global environment # (the \"process dictionary\" in Elixir terms) trace_carrier: :otel_propagator_text_map.inject([]) } end end When a caller passes a message to wrap_message , it\u2019s wrapped in an Envelope , and a serialized version of the active trace context (if any) is added to the trace_carrier field. This Envelope can be sent to other processes without any additional processing. Processes that receive an Envelope need to unpack its trace context so they can continue the trace, and then process the message. However, not all messages a process receives will be wrapped in an Envelope ; messages can still be sent by code that doesn\u2019t use Transport! To solve this, the handle_message function accepts any message and normalizes it, wrapping plain messages in metadata-less Envelopes or passing through messages already wrapped in one. Afterwards, it unpacks the trace context (if any), calls a user-provided handler with the Envelope , and then cleans up the context. This normalization technique was critical for our rollout. Our Elixir services use plenty of message passing, and we couldn't change all of them to use this new scheme overnight. Even if we could, we can\u2019t apply new versions to all nodes instantaneously when we deploy services. Therefore, services needed to handle messages from both old and new versions, including ones that didn't use Transport. defmodule Discord.Transport do alias Discord.Transport.Envelope def handle_message(%Envelope{} = envelope, func) do # Elixir trick: we do this dance to make sure that all fields are present # on the received Envelope if we receive it from another version of # software (provided no required fields are added). envelope = struct(Envelope, Map.from_struct(envelope)) # Extract the context ctx_token = :otel_propagator_text_map.extract(envelope.trace_carrier) result = func.(envelope) # Tear down the context when we\u2019re done OpenTelemetry.Ctx.detach(ctx_token) result end def handle_message(other, func) do func.(%Envelope{message: other}) end def call(destination, message, timeout \\\\ 5000) do message = Envelope.wrap_message(message) GenServer.call(destination, message, timeout) end def cast(destination, message) do message = Envelope.wrap_message(message) GenServer.cast(destination, message) end end A small aside: you might notice we don\u2019t provide a drop-in replacement for Elixir's send function, despite having ones for GenServer \u2019s call and cast . Several of our services already have their own send abstractions, so we opted to add calls to Envelope.wrap_message there instead. When One Span Becomes One Million: Tracing Extreme Fanouts Capturing a span has a non-zero monetary cost and performance overhead. To limit this effect, teams that implement tracing often sample the operations they capture, typically by picking a flat percentage of operations (e.g. randomly selecting 1% of operations). The simplest strategy, and the one we employ, is called head sampling . With this approach, we decide whether or not an operation will be traced when the first span (the \u201croot\u201d span) starts; if it\u2019s sampled, all child spans will be sampled, and vice versa. This sampling decision is stored in each span\u2019s entry in the trace context. Head sampling works great for a lot of request/response-based systems, but Discord\u2019s fanout model means we can quickly explode the number of spans. Let\u2019s imagine we sample someone sending a message to a guild with a million online users. The API service would capture the message creation, then the guilds service would capture the fanout, and then all one million sessions would capture forwarding the message to the client. To keep the volume manageable, we had to find a way to limit the number of spans while still capturing useful performance data. Our first approach was to apply an additional layer of random sampling in the sessions service. If a session wasn't selected by this second layer, no spans would be captured for it, even if it was part of a sampled trace (specifically, we would set the \u201csampled\u201d flag in the trace context to false). This didn\u2019t lose us much data, since the act of forwarding a message to clients should be basically the same across all sessions in a given fanout operation. Unfortunately, this flat sampling rate was a little aggressive, and traces from smaller fanouts often lacked spans from sessions. To fix this, we decided to adjust the rate based on fanout size, which meant we'd have to somehow pass that information to sessions. This is where our shiny new Envelope primitive came in handy. We added a new optional field to the definition, called approximate_num_recipients , which the guild sets before sending the message to sessions. Upon receiving the message, the sessions each check a lookup table to determine the rate for the second layer of sampling. Messages with a single recipient keep their sampling status 100% of the time, messages with 100 recipients 10% of the time, and so on, until we reach our final rate of 0.1% for messages with 10,000+ recipients. A visual representation of the dynamic sampling preservation. The diagram shows that sampling is preserved 100% of the time when a message is sent to a single session, 10% of the time when fanned out to 100 sessions, and 0.1% of the time when fanned out to 10k+ sessions. This approach was hugely successful! We were able to get a good picture of how a fanout performed, without submitting zillions of spans to our providers. Optimizing Overhead for Scale Rolling out tracing to our stack gave us an immediate observability win, but instrumenting certain components added meaningful overhead. Tracing does a good job of capturing application performance, but it can't observe its own overhead; the tracer itself doesn\u2019t capture spans about its own execution. Even if it did, such spans would generate even more overhead. We needed different tools to diagnose where the source of the problem was. After deploying our first set of traces to the guilds service, some of our busiest guilds (we\u2019re talking the ones with millions of members) were unable to keep up with user activity. When this happened, we captured stacktraces of the slow processes every 100 ms or so. This low-cost technique is a great way to get an idea of what a process is doing. In our case, a large share of the stacktraces showed the process unpacking trace context! Every time we send a message with Transport that contains trace context, OpenTelemetry encodes the context as a string, which the recipient must parse to unpack. Our sampling rate was less than 1%, so more than 99% of unpacking operations just told us not to capture child spans. Could we skip unneeded work? What if we only sent the context when capturing a sampled trace? Skipping propagation of unsampled trace contexts modified our head sampling semantics slightly, but didn\u2019t lose traces we otherwise would have captured. It created a new problem, though: intermediate operations could no longer tell if they were part of an unsampled trace and might independently opt themselves into sampling, producing incomplete traces. This is a reasonable trade-off; we can still answer end-to-end questions by querying for traces containing spans from all services. After making this change, we didn\u2019t see a recurrence of the guild performance problems, and we continued instrumenting more components. This came back to bite us when we deployed instrumentation of fanout to the sessions service. Capturing spans while forwarding messages to clients increased CPU usage by 10 percentage points. What gives? In general, capturing a span is quite cheap. Unfortunately, nothing a computer does is free, and even the cheapest operations can be time-sucks at scale. Fanouts can get quite large, so there\u2019s bound to be a decent number of sessions that make the independent decision to start sampled traces. We spent a long time trying to make span capture cheaper, but eventually we asked ourselves the same question: can we just avoid doing this work? The fix was simple: if a session receives a post-fanout message, we forbid it from capturing root spans. In other words, the session can continue existing traces, but not make new ones. This single change won back nearly all of our performance overhead in the sessions service. \u200d The average CPU usage of our sessions service before and after deploying the change to not capture root spans post-fanout. We saw the usage drop from 55% to 45%. Our end-to-end picture wouldn\u2019t be complete if we couldn\u2019t link spans between the API service and the Elixir stack. As mentioned before, the API service already sent trace context as part of gRPC headers, so all we had to do was point OpenTelemetry at these headers. Unfortunately, doing so immediately doubled our CPU usage. By sheer happenstance, one of the team\u2019s engineers had just spent our annual internal Hack Week experimenting with OpenTelemetry\u2019s (at the time, in progress) Erlang/Elixir profiler , which gives us aggregate information about how much CPU time is spent in each function (perhaps a topic for another post!). After enabling it on an affected node, we quickly saw that 75% of our time handling gRPC requests was spent unpacking context. Given our existing head sampling trade-off, could we build a sieve to avoid unpacking unnecessary trace contexts? The structure of the encoded version of trace context. Technically, this is just one of a few components, but we won\u2019t discuss the others in this post. Trace contexts are encoded as a string of several hexadecimal sections, as shown above. Importantly, the last byte of this string is a set of flags on the trace, which we can read very quickly. If the least significant bit is 1, we know the trace is sampled, and we can perform the full, more expensive, unpacking of the trace context. If it\u2019s zero, we simply won\u2019t pass the context along to the Elixir process. This technique brought our CPU usage to nominal levels, and we were ready to call this project done! A profile of our gRPC request handler when handling a gRPC request in our presence service, which fans out DMs and status updates to users. Unpacking (\u201cextracting\u201d) the trace context is taking 14.9 traced seconds, out of 18.9 traced seconds. Enjoying the Fruits of our Labor Tracing has closed a large observability gap for us. We can now see what parts of the platform become slow, why they are slow, and what the downstream effects are. Integrating it wasn\u2019t as easy as it might have been in a traditional HTTP microservice, but we found a way to do it that could survive Discord\u2019s massive scale. At the start of this post, we discussed how a guild can occasionally fail to keep up with its user activity. In a recent incident of this failure mode, our new tool helped us quantify the user impact. Traces from members of that guild showed us that it took almost sixteen minutes for their sessions to connect to the affected guild process. This meant that those users saw a message in their client saying that one of the guilds they\u2019re a member of was offline due to an outage; they weren\u2019t even able to click into the guild during that time. A trace showing a user connecting to Discord, and experiencing a significant delay in gaining access to a degraded guild. Most guilds reported \u201cconnect\u201d spans within a few milliseconds, but the last guild did not report one for sixteen minutes. This kind of session connect latency is extremely rare, thankfully, but our investment in tracing has been incredibly helpful for investigating these issues when they crop up. As we expand our instrumentation of the Elixir stack, we can continue to answer questions that we simply couldn\u2019t before, and use the data to deliver better experiences for our users. If you can imagine a place where talking \u201ctrace\u201d is a perk of the work, check out our careers page from time to time! We\u2019re always hiring! Nick Krichevsky Senior Software Engineer at Discord, distributed systems nerd, and all-around dork. related articles . Search",
+    "quality_score": 9,
+    "modules": [
+      "elixir_patterns",
+      "observability",
+      "concurrency"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/osprey-open-sourcing-our-rule-engine",
+    "title": "Osprey: Open Sourcing our Rule Engine",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers This is a collaborative piece written by Jared Miller and Ayu. Despite virtually every online platform facing these sorts of challenges, many are left to reinvent tools from scratch, with varying degrees of success. We\u2019d like to help our fellow companies get a head-start on their safety measures \u2014 that's why, in partnership with ROOST and the internet.dev team, we\u2019re excited to open-source Osprey : our safety rules engine. With Osprey, teams can investigate real-time activities across their platforms and quickly deploy dynamic rules to address emerging threats, all with minimal engineering overhead. This post will walk you through what Osprey is, how it works, and how your team can start using it to build stronger safety measures. What do we want in a Rule Engine? Fighting bad actors requires tools that can adapt to new challenges in real-time. A service as large as Discord needs a system that can: Process at Scale: Handle thousands of events per second, in real-time, and scale seamlessly as our platform grows. \u200d Enable Rapid Response: Let teams write expressive rules that take effect in minutes. \u200d Provide Clear Decisions : Deliver actionable verdicts on whether ongoing user activities are safe, suspicious, or malicious. \u200d Show Its Work: Offer transparency into how rules were executed and when errors arise, making investigating and debugging straightforward. \u200d Learn and Adap t: Support a continuous feedback loop where detection insights improve future rules. \u200d Stay Future-Proof: Accommodate extensibility for new features to combat attack patterns we have yet to imagine. These requirements shaped every architectural decision we made when developing Osprey, from its rule language to its distributed processing model. How does it work? Key Concepts Osprey is built around several core concepts. It ingests Actions , either synchronously via GRPC or asynchronously via a Message Queue, and runs them through a series of Rules written in SML (just Some Made Up Language) that can be expanded upon with UDFs (User Defined Functions), and processes them via a combination of Features and Effects , some of which can be applied to Entities . Synchronous actions in particular can return Verdict effects, which inform the caller about any determinations made by the rules. All outputs are then sent to our Apache Druid cluster to power our investigations UI. Easy right! \u2026 okay, that was a LOT of bolded words and new terms thrown around. Let\u2019s drill down what all these terms mean: Actions Actions are events that we send to Osprey. Each type of action has a unique ID and schema. They\u2019re effectively JSON blobs consumed by the rules engine, and can be customized to contain whatever data the caller provides. { \"__action_name\": \"user_login_attempted\", \"user\": { \"id\": \"939242044545716254\", \"username\": \"Daffy Duck\", \"email\": \"despicable@example.com\", \"ip\": \"170.83.36.125\", }, } \u200d Rules Rules are the heart of Osprey. Within the main Osprey \u201cengine,\u201d we define a rules language that we call SML (Some Made-up Language). Writing rules should be simple and accessible to folks with minimal technical knowledge, so we based it on Python! Even with a fairly simple syntax, we can make powerful statements, with rules capable of referencing other rules and data. The rules language enables static validation that can enforce a particular way rules should be written. Provided that validation is consistent, new validation logic can be easily added via Python code. It can be as simple as requiring all variable names to start with an uppercase letter, or as complicated as a given case needs. UserId: Entity[int] = EntityJson(type='User', path='$.user.id', coerce_type=True) UserEmail: str = JsonData(type='Email', path='$.user.email', required=False) UserIsDaffy = Rule( when_all=[ UserEmail == 'despicable@example.com', ], description='(known spammer) is trying to register', ) WhenRules( rules_any=[ UserIsDaffy ], then=[ LabelAdd(entity=UserId, label='spammer'), ], ) \u200d UDFs UDFs are functions written in (actual, not SML) Python that can be called anywhere within the rules. UDFs define the standard library for Osprey, such as Rule ( here ), WhenRules ( here ), and JsonData ( here ), to name a few. UDFs are how you\u2019ll be expanding upon Osprey\u2019s language functionality if you decide to incorporate Osprey into your own products. To give an example, if rule writers want to access data from an external service, one may define a UDF to call said service and present the result. @register class LinkSpamScore(HasHelper[LinkSpamScoreProvider], UDFBase[LinkSpamArguments, float]): \"\"\" Get a float [0,1] score from link spam model \"\"\" category: ClassVar[str] = UdfCategories.ML execute_async: ClassVar[bool] = True def execute(self, execution_context: ExecutionContext, arguments: LinkSpamArguments) -> float: provider = execution_context.get_udf_helper(self) accessor = execution_context.get_external_service_accessor(provider) response: PredictResponse = accessor.get(arguments) return response.score \u200d Features A feature is any variable in the global namespace in Osprey. All features must be uniquely named. However, prefixing a `_` at the start of a variable name prevents it from being exported as a feature and keeps the variable within the local file\u2019s namespace. Features are outputs of Osprey executions. Downstream, they are sent to and indexed by Druid, so users can query for events based on feature names later, i.e. `UserEmail == ' despicable@example.com `. UserId: Entity[int] = EntityJson(type='User', path='$.user.id', coerce_type=True) UserEmail: str = JsonData(type='Email', path='$.user.email', required=False) In the example above, both UserId and UserEmail are features. Entities Entities are a special type of Feature. All entities are features, but not all features are entities. Within Discord, these represent persistent units like Users, Servers, or emails. An entity can have effects applied to it, such as labels, classifications, or signals . Every entity has a type that determines which effects can be applied to it based on static validations. Entities get special treatment within the Osprey UI. Clicking on an entity in the tool will take you to an Entity View, providing a deep dive into its history. Effects Effects can be triggered when one or more rules are evaluated to be true. These are validated and handled in aggregate at the end of an execution output. For example, an effect might apply a label to an entity, marking it as a \u201cSpammer\u201d. WhenRules( rules_any=[UserIsDaffy], then=[ LabelAdd(entity=UserId, label='spammer') DeclareVerdict(verdict='reject') ], ) System Components The actual Osprey system is built from a few independently operating services. Actions are first sent to the Osprey Coordinator, which acts as an intermediary between a fleet of Osprey Rules Workers , balancing asynchronous and synchronous requests between them. Rules workers have a locally mounted copy of the Rules . At Discord, we use ETCD to distribute rules to the workers. This lets us push new rules into production without requiring deployment. When the rules worker finishes evaluating an Action , it outputs the result to a configurable set of Output Sinks . These take the results and apply or write them as needed. Among the Output Sinks, one provided by default is a publisher to a Kafka queue, which pipes execution results into a Druid database. All these power investigations via our Osprey UI . Investigative Tooling: The Osprey UI The Osprey UI is our real-time investigation platform for tracking bad actors, analyzing rule performance, and reviewing execution results. Using our custom query language, security teams can run complex queries against our Druid database to spot trends and identify new attack patterns. The interface (displayed below with dummy data) combines an event stream with visualization tools, such as time series charts and Top N tables. This allows teams to spot anomalies quickly, whether it's unusual spikes in account creation, patterns in guild joining behavior, or coordinated Direct Message campaigns. The feedback loop is immediate: insights from investigations directly inform new rules and protections. Integrated Investigation Workflow The Osprey UI treats Entities (like User IDs, Guild IDs, IP addresses), Features (contextual data like usernames), and Effects (like applied labels) as first-class components. This creates a natural investigation workflow where, when examining a suspicious entity, investigators can instantly see all related events, applied labels, and behavioral patterns in one unified view. The interface below uses dummy data to show a User Entity view: Handling Sensitive Data Osprey is hosted on your own infrastructure and can only access data and information you send to it. At Discord, since we use Osprey to respond to incidents that can contain sensitive user data, we maintain strict access controls and audit trails. Team members can only access certain actions or entity-specific views with proper justification and permissions, ensuring user privacy while enabling effective investigations. Operating at Scale Osprey was built to scale. As of December 2025, Discord uses the open source version of Osprey to handle ~400 million actions per day. Although mostly benign, these events provide valuable signals that are then categorized across 204 action types and 2288 rules, with the average action triggering ~500 rules. Among the rules, we\u2019ve included 99 custom UDFs, many of which perform RPCs to other internal services. Individual performance mileage varies based on the amount and complexity of the rules being triggered. The system can support more actions by horizontally scaling the number of rule worker instances. Running the Osprey Coordinator helps balance synchronous and asynchronous actions across the rule workers. This adds some resilience against spiky traffic patterns without over-provisioning the number of rules workers and minimizing the need to add workers on demand. Optimizing Osprey's performance remains a high priority for Discord. By reducing costs and increasing rule executions per second, we can directly enhance Osprey's impact and effectiveness as a safety tool. Customizing Osprey for the Public There is no one-size-fits-all rules engine that can efficiently meet all the needs of every adopter. In its original form, Osprey was built using Discord\u2019s internal libraries, conforming to our internal infrastructure and use cases. From the beginning of our open-sourcing journey, we knew configurability would be essential. We started planning by looking at our complex and featureful system, stripping away components bit by bit until we arrived at a minimal, yet fully-featured, product. To achieve this, we needed to make some changes to our system: The Osprey Rule engine should accept events sent via GRPC requests or via a Message Queue (PubSub or Kafka) as opposed to only accepting events via Osprey Coordinator. We should support open-source alternatives to any proprietary dependencies being used. For example, where we used PubSub, we also want to support Apache Kafka, which can be self-hosted. Only a small set of Discord\u2019s UDFs, particularly simple ones without external dependencies, would be included out of the box. We should provide an adaptor layer for users to easily incorporate their own custom UDFs. We should support loading Rules via the file system at build time. The ability to hotload rules via ETCD would be maintained, but we didn\u2019t want to require an extra dependency and configuration step for those who could do without. The rules engine should return Verdicts. These could be ignored if passing in actions asynchronously, but they serve as a clear communication method to synchronous callers. We should support arbitrary Output Sinks so users can process execution results as they wish. We also wanted to provide optional extra features to everyone: A UI investigation tool. This required having an Output Sink publishing to a Kafka topic and subscribed to via Druid. The Osprey Coordinator, which can act as a load-balancer to prioritize synchronous actions when facing surges of asynchronous actions. It\u2019s particularly useful in environments where traffic can be bursty. For systems that don\u2019t require the Coordinator, such as ones with little traffic or upstream rate limiting, Actions can be sent directly to the rules workers using the same methods (GRPCs for synchronous and a Message Queue for asynchronous). What we knew we wouldn\u2019t be able to provide: Our full set of UDFs and Rules. This included things like our Counter service, which is heavily integrated with our internal Scylla databases. Our full set of Output Sinks. For example, we write all of our rule execution results to BigQuery. While this might be useful to some, it\u2019s not strictly necessary, and we didn\u2019t want to bias towards any non-open-sourced software. Taking our existing rules engine and making it conform to these requirements, while still operating for our needs, was akin to repairing a car engine while driving down the highway. We made UDFs, Rules, and Output Sinks configurable by using the \u201cPluggy\u201d Python library . We then removed and replaced internal Discord dependencies one by one, placing our internal configurations behind our new Pluggy integrations. And even as changes were being made, we carefully tested and deployed into our own production environment (but not at the same time), maintaining parity with our intended end product while weeding out potential bugs that could pop up along the way. In the end, it took months of work among five incredible engineers to carve out our tool for the public. What\u2019s Osprey Flying Towards Next? Open-sourcing Osprey is just the beginning. We\u2019ve got an ambitious roadmap ahead, focused on making the tool even more powerful and accessible for the community. A sneak peek at some of our plans: We\u2019re looking into performance improvements to support even higher volumes of actions per second for the Rule Engine. Upgrading dependencies to their latest versions to support newer, more advanced features. Improving our documentation, including best practice guides and tutorials for using the service. Build out a toolkit of open-sourced plugins for Osprey, like the Counter service. Join Us in Building Better Safety Tools The safety challenges facing online platforms are bigger than any one company can solve alone. That's why we are proud to participate in efforts like ROOST and why we're committed to building Osprey as a true community project. Whether you're contributing code, joining the public working group meetings, sharing use cases, or just providing feedback, your participation helps make the internet safer for everyone. We actively encourage contributions of all kinds: new features, performance improvements, documentation, or creative applications we haven't thought of yet. Your unique perspective and challenges can help make Osprey better for the entire community. At Discord, we believe the best safety innovations happen when we all work together. We're committed to long-term investment in Osprey's development and will continue working with our partners at ROOST to bring more powerful safety tools to the open source community . Discord Engineering We make Discord! related articles . Search",
+    "quality_score": 9,
+    "modules": [
+      "design_patterns",
+      "security",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://quarkus.io/blog/mmaler-blogpost-2-quarkus-runtime-and-framework-for-cloud-native-java/",
+    "title": "Quarkus: A Runtime and Framework for Cloud-Native Java",
+    "source_name": "Quarkus Blog",
+    "text": "Beyond staple traits of modern frameworks, Quarkus introduces two platform-defining features: buildtime optimization and deep extensibility. Buildtime optimization : Quarkus shifts work from runtime to build time wherever possible. This approach reduces startup overhead and memory usage, resulting in a lean, fast, and efficient application tailored for production. Figure 1. Quarkus performs at build time what traditional frameworks do at runtime: reading configuration files, scanning annotations, and building a model of the application. Figure 2. Thanks to buildtime initialization, the resulting application starts faster and consumes less memory. Figure 3. All the benefits of buildtime initialization also apply when compiling to a native binary. Extensibility : Quarkus exposes extension points for everything from startup hooks to request filters. Over 800 extensions allow seamless integration with modern technologies such as Kafka, OpenTelemetry, and OpenID Connect. These extensions integrate with Quarkus and participate in its buildtime and runtime lifecycle, making them first-class components of Quarkus. Simplified developer experience Frameworks succeed when they reduce complexity without sacrificing flexibility. Quarkus does exactly that: Preconfigures popular libraries with sensible defaults. Offers unified configuration and developer tooling. Provides instant feedback with live reload and continuous testing. Dev Services for automatic provisioning of databases, brokers, and other services in dev mode. Continuous testing to run tests in the background and surface results immediately. This makes Quarkus both powerful and approachable. You can start with a simple REST endpoint and scale it into a production-grade service without changing your development model. Figure 4. Frictionless developer experience: Vastly improved development feedback loop, unified approach to producing different package types, and using proven APIs that Java developers already know. These features give developers structure, sensible defaults, and clear conventions during development, and they deliver fast startup, low memory use, and operational consistency in production. Performance that matters Teams optimize for different goals, such as startup latency, sustained throughput, memory footprint, elasticity, and cost. Quarkus addresses these needs by shifting work from run time to build time, keeping one development model across JVM and native, and exposing production signals such as health checks, metrics, and tracing. Start with JVM mode for most services. On the JVM, Quarkus often starts faster and uses less memory than traditional JVM-based runtimes because it performs more work at build time. Just-in-time compilation raises steady-state throughput, scales well across cores, and offers mature garbage collectors and tuning options. The JVM also provides rich observability and diagnostics, which help you understand and tune live systems. Use native mode when startup latency and memory footprint are strict constraints. Native executables start in milliseconds and can use less memory, which supports scale-to-zero workflows and lowers idle costs on small instances. Trade-offs include lower peak throughput, limited multi-core scaling, a single-threaded garbage collector in current native images, longer build times, and a slower inner loop for developers. If your system needs both profiles, split by workload. Run bursty or event-driven endpoints in native mode, and run long-lived high-throughput services on the JVM. Observability note. JVM mode exposes richer diagnostics and metrics, including GC, heap, and thread telemetry, JFR, and profiler support, which makes issue triage and performance tuning easier. Native mode still exports application-level metrics and traces with Micrometer and OpenTelemetry, but it offers fewer VM-level signals. Always measure your workload: For native, reduce reflection and dynamic class loading, trim resources, and consider profile-guided optimizations (PGO) where supported. PGO is not available in Mandrel and currently requires an Oracle GraalVM distribution that provides PGO. For the JVM, choose a garbage collector that matches your latency and heap goals, budget for warmup, and test steady-state throughput under realistic load. Taken together, these in production choices provide measurable wins: Vodafone Greece replaces Spring Boot with Quarkus Quarkus vs. Spring Boot Security Quarkus uses a standards-first composable security model. You enable what you need and configure it for your environment: Transport: Enable HTTPS in the application by configuring TLS. Authentication: Choose Basic, form-based, mTLS, OpenID Connect (OIDC), or WebAuthN. Authorization: Enforce RBAC on web endpoints with @RolesAllowed , @DenyAll , and @PermitAll . This lets you apply the right security controls for each deployment. Observability and control surfaces Common control surfaces, such as metrics, logging, tracing, and configuration, are essential for site reliability engineers (SREs) and platform teams. Quarkus exposes: Unified logging with quarkus-logging . Centralized logging with OpenTelemetry (OTLP logs) with OpenTelemetry . Metrics and tracing with Micrometer and OpenTelemetry . Unified configuration of all the application\u2019s aspects by using application.properties or environment variables. This standardization enables automation and scalable monitoring. Modular and production-ready Following a lean-core, modular-at-the-edge approach, Quarkus delivers: A minimal core for fast startup. Pluggable extensions for authentication, tracing, messaging, and more. Built-in production primitives, including health checks, readiness and liveness probes, and graceful shutdown. Fault tolerance with standard annotations, for example, retries, circuit breakers, bulkheads, and timeouts. Whether you are building a prototype or deploying to OpenShift, Quarkus adapts. This modularity spans both the framework-level APIs developers work with and the runtime behaviors that execute beneath them. Because Quarkus modularity is declarative and unified across extensions, it supports a platform-like developer experience without the rigidity of traditional frameworks. Building your stack with Quarkus We will explore this topic in depth in part 3 of this series. For now, here is how Quarkus fits into the picture. Frameworks can serve as a foundation for creating higher-level abstractions. Quarkus fits this model by enabling teams to build customized stacks and internal frameworks on top of it. Unlike many traditional frameworks, Quarkus provides a unified extension architecture that supports deep customization. Organizations can tailor Quarkus to fit specific domains, technologies, or compliance needs. This enables the creation of organization-specific developer experiences, including internal stacks built on a unified Quarkus extension architecture. By encouraging consistency, offering buildtime integration, and exposing clean extension points, Quarkus supports the creation of opinionated, scalable internal frameworks without forking or reinventing the core. By packaging Quarkus extensions, curated defaults, and service templates into an internal Quarkus stack, teams focus on business logic. At the same time, your framework layer standardizes infrastructure, security, and operational integrations across services. This has been proven by Logicdrop, who refactored their entire Spring Boot stack with Quarkus, reducing container size by ~75%, achieving sub-second startup times, and significantly improving developer productivity.",
+    "quality_score": 8,
+    "modules": [
+      "java_patterns",
+      "architecture_patterns",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://quarkus.io/blog/leyden-1/",
+    "title": "How Project Leyden brought a new perspective",
+    "source_name": "Quarkus Blog",
+    "text": "This is a story about Project Leyden. And this is not a story about Project Leyden. It is a story about how Project Leyden gave us a new perspective on how we think about startup performance in Quarkus, and, more broadly, in Java. It is a story with flamegraphs. Isn\u2019t it the best kind of story? Acknowledgments I shared this journey with my dear colleague Georgios Andrianakis, who was also instrumental in making this happen. And this is exactly the kind of journey you want to share with someone. How the story started It all started with me complaining, more than once, that improving startup performance in Quarkus had become really hard. Startup was cluttered with class loading noise. Which means that every time you looked at a startup profile, you clicked on something suspicious and realized: Oh well, that\u2019s just us loading a class for the first time\u2026\u200b bummer. I\u2019m a patient person. But you only get so many mouse clicks per day. Then, one day, I took a shower, and I had this idea: Isn\u2019t Project Leyden supposed to improve the class loading story, among other things? Maybe we could use it to get rid of the class loading noise and get a clearer picture of what\u2019s really going on during startup? As it turns out, this was a bit of a rabbit hole. Project Leyden delivered results that were far better than expected, and we ended up working with Georgios on integrating it tightly in Quarkus (you can see another blog post coming, right?). But today, I promised you flamegraphs. I know you\u2019re all excited about them. Let\u2019s get to it! Changing the perspective We\u2019ll explore this in more detail in a future blog post, but for now, suffice it to say that Project Leyden caches classes in a loaded and linked state, along with additional metadata such as method profiling information and, soon, compiled code. In practice, Project Leyden improves Java startup performance by shifting expensive work, like class loading and linking, into a dedicated training phase. By capturing that state ahead of time, the application can skip much of the redundant setup normally performed at runtime. In other words, if everything is recorded properly, class loading can be almost entirely taken out of the startup path. And suddenly, you\u2019re in brand-new territory: the Quarkus REST application you get from a simple quarkus create app starts in 130 milliseconds. That\u2019s already pretty good, right? But what\u2019s even more interesting is that we were able to do much better (see you in the next blog post, remember?). And this is where the perspective shifts significantly: when you start in ~ 100 milliseconds, every dozen milliseconds you save becomes a meaningful improvement. You can no longer afford to ignore a 5-millisecond cost. I can hear someone in the room shouting: Stop with the words! I want my flamegraphs! Fine, fine. How can we improve as an ecosystem? One extremely important note before we begin: we\u2019re not trying to criticize any library or framework here . We also found some low-hanging fruits in Quarkus itself, we\u2019re all in the same boat here . The goal of this blog post is to show how Project Leyden helped us uncover things that had been hidden for far too long. And hopefully, this will give other library and framework authors a few useful ideas, and ultimately help improve the Java ecosystem as a whole. And in the worst case, at least you got your flamegraphs \\o/. Compatibility layers Figure 1. Netty trying to determine whether virtual threads are available Many libraries include compatibility layers to support multiple JDK versions. Typically, they rely on reflection to determine whether features like virtual threads are available. In the Quarkus ecosystem, this is common in low-level libraries such as Netty or Vert.x. But in reality, we see this pattern everywhere. We should avoid this. It has a cost, and that cost is paid at every single startup of every application using these libraries. Multi-release JARs are not perfect. They\u2019re harder to maintain, harder to test, and not always well supported by IDEs. But they do solve this problem. And I would argue that, as library and framework authors, it\u2019s our responsibility to ensure the cost is paid once at build time, not at every application startup. Together with Georgios, we decided to experiment with rewriting the bytecode of some of these libraries at build time to remove the reflective calls and replace them with direct invocations, when the application was targeting a Java version that supports the feature. It\u2019s a bit of a hack, and definitely not something we want to maintain long term, but it was a great way to validate the idea and score a few quick wins. Reading annotations This one isn\u2019t new to us: one of the reasons we wrote Quarkus in the first place was to avoid reading annotations at runtime. For most of our use cases, we can process annotations at build time and generate the necessary bytecode so there\u2019s no need to inspect them at runtime. Jandex, our annotation indexer, is a fantastic tool for this, and we use it extensively in Quarkus. But\u2026\u200b there are still cases where annotations are read at runtime, even in Quarkus. Why is reading annotations so costly? Because parsing them has a cost. It happens the first time you try to access them at runtime, and the JDK then creates proxy instances to expose the annotation values. Netty and marker annotations Figure 2. Netty trying to determine if a ChannelHandler is sharable The Netty case is particularly interesting because it reads annotations to determine the capabilities of interface implementations. For this kind of use case, we recommend using marker interfaces or methods instead of annotations. Georgios once again resorted to bytecode rewriting to eliminate the annotation lookup. Again, this isn\u2019t something we want to maintain in the long term. Hibernate ORM Hibernate ORM is also extremely interesting in this context. The first important point is that, with Hibernate ORM, in Quarkus, we still build the metadata at runtime. That means we end up reading a lot of annotations at runtime. A long-term effort has already started to improve this situation, but it\u2019s a significant undertaking and will take time before we can move metadata building to build time instead. Let\u2019s set that aside for now. What\u2019s also interesting is that Hibernate ORM collects metadata about its own annotations at runtime, both Hibernate-specific annotations and JPA annotations. And that\u2019s a lot of annotations, and a lot of metadata to process. Figure 3. Hibernate ORM collecting metadata about its own annotations For example, for each JPA or Hibernate annotation, it determines the annotation target (class, method, field), or whether it is inherited. In the end, this results in a substantial amount of annotation processing for something that changes very rarely. I identified this issue some time ago, and our colleague Luca Molteni from the Hibernate team will be looking into it soon. We\u2019re not yet sure how easy it will be to fix, but you get the idea. Whenever possible, this kind of metadata should be resolved once and for all. And you should be able to enforce its correctness with tests to ensure it remains accurate and up to date. Hopefully, we\u2019ll be able to improve this soon. And the nice part is that any improvement here will benefit all applications using Hibernate ORM, not just Quarkus applications. The new cost of loading When not using Leyden, you load a gazillion classes. JAR files are opened anyway, that\u2019s \"fine\" . Well, depending on your definition of \"fine\" . When using Leyden, you can reach a point where no classes are loaded at startup at all. Which means that anything attempting to load something from the classpath will trigger JAR files to be opened (the first time they are accessed), and then read from disk. And you can be sure that some resources will be loaded from your classpath: ServiceLoader service files (the ones in META-INF/services/ ), used by the JDK and many libraries and frameworks to discover interface implementations; Configuration files; And probably many other things. Non-existing classes and resources Why would you try to load a non-existing class? That\u2019s a good question. Figure 4. Hibernate ORM trying to load non-existing package-info Remember package-info.java files? Hibernate ORM, for instance, tries to load them to inspect package-level annotations. In a lot of cases, these files don\u2019t exist, and that\u2019s perfectly normal. Caching class loading is within the scope of Leyden, but Leyden does not cache negative lookups. Why? Because Leyden, while AOT, is still true Java. Java is a dynamic language: even if a class wasn\u2019t present when you recorded the cache, it might be added later. Now, in practice, that\u2019s often not the case, especially in Quarkus, where we assume a closed world, but Leyden cannot rely on that assumption. In Quarkus, when using Leyden, we decided to generate empty package-info classes for all packages containing entities that don\u2019t already have one. This way, Hibernate ORM doesn\u2019t have to attempt to load non-existing classes. Figure 5. JBoss Logging loading a non-existing class Another example is JBoss Logging internationalization: it attempts to load a class for the current locale, and if that class doesn\u2019t exist, it falls back to the default class. You see similar patterns with resources. An application might try to load a configuration file or a service descriptor that doesn\u2019t exist. That\u2019s perfectly normal, the only way to know it\u2019s missing is to try. In Quarkus, we have a few class loader tricks to mitigate this. But in the general case, you have to deal with it. And here\u2019s the catch: for all these cases, the runtime will walk the entire classpath (remember, it won\u2019t find anything), trying to locate the class or resource. In doing so, it may open a large number of JAR files and read from them, just to conclude that the class or resource doesn\u2019t exist. Granted, it doesn\u2019t read the entire JAR, each archive has an index, but still. ServiceLoader Figure 6. A ServiceLoader storm Let\u2019s look at the ServiceLoader case in more detail, it\u2019s particularly interesting. Once class loading is out of the picture, it becomes clear that a significant portion of startup time is spent loading service descriptors from JAR files. We managed to improve this for some services using a class loader trick, but that only works for services loaded through the thread context class loader. We don\u2019t yet have a good solution for services loaded by the JDK class loaders. At least not for now. We\u2019ll go into more detail in the next blog post, where we\u2019ll talk more about Project Leyden itself and how we integrated it into Quarkus. Stay tuned. Some other fun facts UUID generation Figure 7. Generating a UUID for the first time This one is easy: whenever you generate a UUID , the JDK will initialize a SecureRandom instance. And initializing a SecureRandom instance doesn\u2019t come for free, oh no. Sure, if your application ends up needing a SecureRandom anyway, you don\u2019t care. But if it doesn\u2019t, having your favorite framework generate UUID s for internal use is not ideal. Obviously, if your application genuinely needs UUID generation, go ahead and use it. BigDecimal Figure 8. Initialization of BigDecimal In the same vein, the BigDecimal class has a static initializer that actually performs a fair amount of work. Initializing BigDecimal can take a noticeable amount of time. We stumbled upon this because we were using BigDecimal to perform some calculations when printing the Quarkus startup time. D\u2019oh. We replaced that code, only to discover another issue: BigDecimal was also being eagerly initialized in Hibernate ORM for a very narrow use case in the DurationJavaType class. That has since been fixed as well. Just like with UUID s, if your application genuinely needs BigDecimal , you should use it and pay the cost. This is about avoiding the cost when you don\u2019t actually need it. Time zones Figure 9. Loading the time zone database We all know time zones are hard. But now we also know that loading them is slow. The time zone database is quite large, and loading it, for example when calling TimeZone.getDefault() , can take a noticeable amount of time. Who would need a time zone in a server application, right? For instance, your logging layer, which wants to print timestamps in the local time zone. Figure 10. Loading the zone rules And what\u2019s also interesting is that there\u2019s an additional cost for transforming the time zone to a ZoneId , as you also have to load the zone rules. These two issues still exist and I have no idea if we can even solve them, but we were able to mitigate their cost somewhat in Quarkus when using the specific packaging we developed for AOT. Conclusion This post is about the work we did in Quarkus and the libraries Quarkus relies on. But I would argue that the lessons we learned are applicable across the entire Java ecosystem. I hope that by sharing our experience, we can inspire other projects, especially library and framework authors, to take a similar approach and improve their startup performance. And to be honest, this isn\u2019t just about improving startup performance, it\u2019s also about reducing the resources wasted during startup. We often talk about Green IT; let\u2019s make our libraries and frameworks greener, especially in cases where it\u2019s simple to achieve. We\u2019ve shared some of our findings and recipes, but I\u2019m sure there are others that are specific to each library and framework. Now is a great time to look at your own startup profiles and see if you can spot some low-hanging fruit to boost performance. And with Quarkus 3.32 and our new AOT integration coming soon, this is going to be easier than ever. If you have questions, you know where to find us , and if you find something interesting, please share it with us, we\u2019d love to hear about it! Onwards! Come Join Us We value your feedback a lot so please report bugs, ask for improvements\u2026\u200b Let\u2019s build something great together! If you are a Quarkus user or just curious, don\u2019t be shy and join our welcoming community: provide feedback on GitHub ; craft some code and push a PR ; discuss with us on Zulip and on the mailing list ; ask your questions on Stack Overflow .",
+    "quality_score": 8,
+    "modules": [
+      "java_patterns",
+      "complexity",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://github.blog/security/supply-chain-security/a-year-of-open-source-vulnerability-trends-cves-advisories-and-malware/",
+    "title": "A year of open source vulnerability trends: CVEs, advisories, and malware",
+    "source_name": "The GitHub Blog",
+    "text": "Reviewed advisories hit a four-year low, malware advisories surged, and CNA publishing grew\u2014here\u2019s what changed and what it means for your triage and response. March 26, 2026 | 10 minutes Share: GitHub published 4,101 reviewed advisories in 2025. This is the fewest number of reviewed advisories since 2021 . Does this mean open source is shipping more secure code? Let\u2019s dig into the data to find out. GitHub reviewed advisories Fewer advisories reviewed doesn\u2019t mean fewer vulnerabilities were reported. The drop is because GitHub reviewed far fewer older vulnerabilities . When you look only at newly reported vulnerabilities from our sources , GitHub actually reviewed 19% more advisories year over year. So why the change? Quite frankly, we are running out of unreviewed vulnerabilities that are older than the Advisory Database . At the same time, the number of newly reported vulnerabilities hasn\u2019t dropped. It\u2019s also worth clarifying that \u201c unreviewed \u201d in the database can be misleading: most advisories marked unreviewed have already been looked at by a curator and found not to affect any package in a supported ecosystem , so they may never be fully reviewed. This means that you should be receiving fewer brand-new Dependabot alerts about old vulnerabilities. Note : If you find an unreviewed advisory that affects a supported package, please let us know so we can get it reviewed! How vulnerabilities were distributed across ecosystems in 2025 The distribution of ecosystems in advisories reviewed in 2025 is similar to the overall distribution in the database, with the exception of Go. Go is overrepresented in 2025 advisories by 6%. This is largely due to dedicated campaigns to re-examine potentially missing advisories found through an internal review for packages where we had inconsistent coverage. How the types of vulnerabilities changed in 2025 Rank Common Weakness Enumeration (CWE) Number of 2025 Advisories* Change in Rank from 2024 Change in Rank from the Overall Database 1 CWE-79 672 +0 +0 2 CWE-22 214 +2 +1 3 CWE-863 169 +9 +8 4 CWE-20 154 +1 +1 5 CWE-200 145 -2 -1 6 CWE-400 144 +4 +0 7 CWE-770 136 +7 +10 8 CWE-502 134 +5 +1 9 CWE-94 119 -3 -1 10 CWE-918 103 +5 +8 * An advisory may have more than CWE. For example, an advisory might have both CWE-400 and CWE-770. It would then count for both. As usual, cross-site scripting (CWE-79) is by far the most common vulnerability type. However, there are significant changes in the following areas. Resource exhaustion (CWE-400 and CWE-770), unsafe deserialization (CWE-502), and server-side request forgery (CWE-918) were unusually common in 2025. CWE-863 (\u201cIncorrect Authorization\u201d) saw a significant jump, but that is largely due to reclassification away from CWE-284 (\u201cImproper Access Control\u201d) and CWE-285 (\u201cImproper Authorization\u201d), which are higher level CWEs that the CWE program discourages using. One of the biggest quality improvements in 2025 was more specific, more consistent CWE tagging. Advisories without any CWE dropped 85% (from 452 in 2024 to 65 in 2025). CWE-20 (\u201cImproper Input Validation\u201d) is still common, but in prior years it was often the only CWE listed on an advisory. In 2025, advisories far more often list CWE-20 plus one or more additional CWEs that describe the concrete failure mode. This added specificity makes the data more actionable for triage, prioritization, and remediation. To find out how to filter Dependabot alerts by CWE, see our documentation on auto-triage rules . How to prioritize your response We provide two scoring systems for prioritization: Common Vulnerability Severity Score (CVSS) : Scores how severe the impact of the vulnerability will be Exploit Prediction Scoring System (EPSS) : Provides a measure of how likely the vulnerability will be attacked in the next 30 days and Together, they can give you a head start on your risk assessment process. As you can see, when considering impact, most vulnerabilities skew moderate to high of the impact range. Low-impact vulnerabilities are likely more common than the CVSS data suggests but are often not considered worth the time and effort for researchers and maintainers to report. The EPSS scores for moderate to high impact vulnerabilities support this decision. So should you trust the EPSS or CVSS scores? To judge that, let\u2019s look at how they match up to vulnerabilities in CISA\u2019s Known Exploited Vulnerabilities Catalog . The exploited vulnerabilities are at least scored moderate, and most are critical or high. While CVSS has more of the exploited vulnerabilities as critical, it also has far more vulnerabilities in the range in general. Combining the two can help you prioritize which vulnerabilities to address to prevent exploitation. npm malware advisories 2025 was a huge year for npm malware advisories. Due to large malware campaigns, such as SHA1-Hulud , GitHub saw a 69% increase in published malware advisories compared to 2024. This is the most malware advisories GitHub has published since our initial release of historical malware when we added support in 2022 . You can receive Dependabot alerts when your repositories depend on npm packages with known malicious versions. When you enable malware alerting, Dependabot matches your npm dependencies against malware advisories in the GitHub Advisory Database. GitHub CVE Numbering Authority (CNA) CVE publications 2025 was a big year for the GitHub, Inc. CNA . We saw a 35% increase in published CVE records , outpacing the overall CVE Project\u2019s increase of 21%. In fact, we saw 10 to 16% growth every quarter. If this trend continues, GitHub will publish over 50% more CVEs in 2026. You can help make that a reality by requesting a CVE from us the next time you publish a repository security advisory about a vulnerability! Organizations using GitHub\u2019s CNA Every year, GitHub sees more organizations use its CNA services. 2025 is no exception with a 20% increase in new organizations requesting CVE IDs . Unlike reviewed global advisories, which are always mapped to packages in ecosystems we support, any maintainer on GitHub can request a CVE , even if they don\u2019t publish that package to a supported ecosystem. In fact, 2025 is the first year that GitHub has published more CVEs from organizations that do not use a supported ecosystem than those that do. We would like to thank all 987 organizations that published CVEs with us in 2025 and highlight the top 10 most prolific organizations. Top 10 organizations using the GitHub CNA Organization Number of 2025 CVEs LabReDeS (WeGIA)* 130 XWiki 40 Frappe 28 Discourse 27 Enalean 27 FreeScout* 27 DataEase 26 Nextcloud 25 GLPI 24 DNN Software* 23 * Organizations that published CVEs through GitHub for the first time in 2025 Onward to 2026 The data from 2025 shows incredible growth: 4,101 reviewed advisories 7,197 malware advisories 2,903 CVEs published 679 new organizations using our CNA services . These numbers represent real security improvements for millions of developers. You can be part of this in 2026. Here\u2019s how: 1. Use our CNA services Publishing CVEs shouldn\u2019t be complicated. Request a CVE directly from your repository security advisory, and we\u2019ll take care of curating and publishing it for you. It\u2019s free, it\u2019s fast, and it helps the entire ecosystem understand and respond to vulnerabilities. 2. Improve advisory accuracy Found an unreviewed advisory affecting a supported package? See incorrect severity scores or missing affected versions? Suggest edits . Your edits will be reviewed by the Advisory Database team and ultimately, will help make the database more accurate for everyone. In 2025, 675 contributions from the community improved the quality of this data for the entire software industry! 3. Protect your projects The most direct impact you can have is protecting your own code. Enable Dependabot to automatically receive security updates and explore GitHub Advanced Security for comprehensive protection. 4. Make reporting a vulnerability easier Let researchers know how to report to you and what you will and will not accept by creating a security policy for your repository. Enable private vulnerability reporting to make the coordination process smooth and secure. Let\u2019s make 2026 even better. See you in next year\u2019s review! \ud83d\ude80 Tags: CVE CVSS CWE Dependabot EPSS GitHub Security Lab malware vulnerability Written by Security Analyst, curator of the GitHub Advisory Database, and one of the members of the Security Lab responsible for issuing CVE IDs and publishing CVE records. Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "dependency_health",
+      "security",
+      "observability"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/",
+    "title": "Your frontend, backend, and database \u2014 now in one Cloudflare Worker",
+    "source_name": "Cloudflare Blog",
+    "text": "2025-04-08 11 min read In September 2024 , we introduced beta support for hosting , storing, and serving static assets for free on Cloudflare Workers \u2014 something that was previously only possible on Cloudflare Pages . Being able to host these assets \u2014 your client-side JavaScript, HTML, CSS, fonts, and images \u2014 was a critical missing piece for developers looking to build a full-stack application within a single Worker . Today we\u2019re announcing ten big improvements to building apps on Cloudflare. All together, these new additions allow you to build and host projects ranging from simple static sites to full-stack applications, all on Cloudflare Workers: Cloudflare Workers now provides production ready, generally available (GA) support for React Router v7 (Remix) , Astro , Hono , Vue.js , Nuxt , Svelte (SvelteKit) , and more , with GA support for more frameworks including Next.js , Angular , and SolidJS (SolidStart) to follow in Q2 2025. You can build complete full-stack apps on Workers without a framework: you can \u201c just use Vite \" and React together, and build a backend API in the same Worker. See our Vite + React template for an example. The adapter for Next.js \u2014 @opennextjs/cloudflare , introduced in September 2024 as an early alpha, is now v1.0-beta , and will be GA in the coming weeks. Those using the OpenNext adapter will also be able to easily upgrade to the recently announced Next.js Deployments API . The Cloudflare Vite plugin is now v1.0 and generally available. The Vite plugin allows you to run Vite\u2019s development server in the Workers runtime ( workerd ), meaning you get all the benefits of Vite, including Hot Module Replacement , while still being able to use features that are exclusive to Workers (like Durable Objects). You can now use static _headers and _redirects configuration files for your applications on Workers, something that was previously only available on Pages. These files allow you to add simple headers and configure redirects without executing any Worker code. In addition to PostgreSQL , you can now connect to MySQL databases in addition from Cloudflare Workers, via Hyperdrive . Bring your existing Planetscale, AWS, GCP, Azure, or other MySQL database, and Hyperdrive will take care of pooling connections to your database and eliminating unnecessary roundtrips by caching queries. More Node.js APIs are available in the Workers Runtime \u2014 including APIs from the crypto , tls , net , and dns modules. We\u2019ve also increased the maximum CPU time for a Workers request from 30 seconds to 5 minutes. You can now bring any repository from GitHub or GitLab that contains a Worker application , and Workers Builds will take care of deploying the app as a new Worker on your account. Workers Builds is also starting much more quickly (by up to 6 seconds for every build). You can now set up Workers Builds to run on non-production branches , and preview URLs will be posted back to GitHub as a comment . The Images binding in Workers is generally available, allowing you to build more flexible, programmatic workflows. These improvements allow you to build both simple static sites and more complex server-side rendered applications. Like Pages , you only get charged when your Worker code runs, meaning you can host and serve static sites for free. When you want to do any rendering on the server or need to build an API, simply add a Worker to handle your backend. And when you need to read or write data in your app, you can connect to an existing database with Hyperdrive , or use any of our storage solutions: Workers KV , R2 , Durable Objects , or D1 . If you'd like to dive straight into code, you can deploy a single-page application built with Vite and React, with the option to connect to a hosted database with Hyperdrive, by clicking this \u201cDeploy to Cloudflare\u201d button: Start with Workers Previously, you needed to choose between building on Cloudflare Pages or Workers (or use Pages for one part of your app, and Workers for another) just to get started. This meant figuring out what your app needed from the start, and hoping that if your project evolved, you wouldn\u2019t be stuck with the wrong platform and architecture. Workers was designed to be a flexible platform, allowing developers to evolve projects as needed \u2014 and so, we\u2019ve worked to bring pieces of Pages into Workers over the years. Now that Workers supports both serving static assets and server-side rendering, you should start with Workers . Cloudflare Pages will continue to be supported, but, going forward, all of our investment, optimizations, and feature work will be dedicated to improving Workers. We aim to make Workers the best platform for building full-stack apps, building upon your feedback of what went well with Pages and what we could improve. Before, building an app on Pages meant you got a really easy, opinionated on-ramp, but you\u2019d eventually hit a wall if your application got more complex. If you wanted to use Durable Objects to manage state, you would need to set up an entirely separate Worker to do so, ending up with a complicated deployment and more overhead. You also were limited to real-time logs, and could only roll out changes all in one go. When you build on Workers, you can immediately bind to any other Developer Platform service (including Durable Objects , Email Workers , and more), and manage both your front end and back end in a single project \u2014 all with a single deployment. You also get the whole suite of Workers observability tooling built into the platform, such as Workers Logs . And if you want to rollout changes to only a certain percentage of traffic, you can do so with Gradual Deployments . These latest improvements are part of our goal to bring the best parts of Pages into Workers. For example, we now support static _headers and _redirects config files, so that you can easily take an existing project from Pages (or another platform) and move it over to Workers, without needing to change your project. We also directly integrate with GitHub and GitLab with Workers Builds , providing automatic builds and deployments. And starting today, Preview URLs are posted back to your repository as a comment , with feature branch aliases and environments coming soon. To learn how to migrate an existing project from Pages to Workers, read our migration guide . Next, let\u2019s talk about how you can build applications with different rendering modes on Workers. Building static sites, SPAs, and SSR on Workers As a quick primer, here are all the architectures and rendering modes we\u2019ll be discussing that are supported on Workers: Static sites : When you visit a static site, the server immediately returns pre-built static assets \u2014 HTML, CSS, JavaScript, images, and fonts. There\u2019s no dynamic rendering happening on the server at request-time. Static assets are typically generated at build-time and served directly from a CDN , making static sites fast and easily cacheable. This approach works well for sites with content that rarely changes. Single-Page Applications (SPAs) : When you load an SPA, the server initially sends a minimal HTML shell and a JavaScript bundle (served as static assets). Your browser downloads this JavaScript, which then takes over to render the entire user interface client-side. After the initial load, all navigation occurs without full-page refreshes, typically via client-side routing. This creates a fast, app-like experience. Server-Side Rendered (SSR) applications : When you first visit a site that uses SSR, the server generates a fully-rendered HTML page on-demand for that request. Your browser immediately displays this complete HTML, resulting in a fast first page load. Once loaded, JavaScript \" hydrates \" the page, adding interactivity. Subsequent navigations can either trigger new server-rendered pages or, in many modern frameworks, transition into client-side rendering similar to an SPA. Next, we\u2019ll dive into how you can build these kinds of applications on Workers, starting with setting up your development environment. Setup: build and dev Before uploading your application, you need to bundle all of your client-side code into a directory of static assets . Wrangler bundles and builds your code when you run wrangler dev , but we also now support Vite with our new Vite plugin . This is a great option for those already using Vite\u2019s build tooling and development server \u2014 you can continue developing (and testing with Vitest ) using Vite\u2019s development server, all using the Workers runtime. To get started using the Cloudflare Vite plugin, you can scaffold a React application using Vite and our plugin, by running: npm create cloudflare@latest my-react-app -- --framework=react When you open the project, you should see a directory structure like this: ... \u251c\u2500\u2500 api \u2502 \u2514\u2500\u2500 index.ts \u251c\u2500\u2500 public \u2502 \u2514\u2500\u2500 ... \u251c\u2500\u2500 src \u2502 \u2514\u2500\u2500 ... ... \u251c\u2500\u2500 index.html \u251c\u2500\u2500 package.json \u251c\u2500\u2500 vite.config.ts \u2514\u2500\u2500 wrangler.jsonc If you run npm run build , you\u2019ll see a new folder appear, named /dist . ... \u251c\u2500\u2500 api \u2502 \u2514\u2500\u2500 index.ts \u251c\u2500\u2500 dist \u2502 \u2514\u2500\u2500 ... \u251c\u2500\u2500 public \u2502 \u2514\u2500\u2500 ... \u251c\u2500\u2500 src \u2502 \u2514\u2500\u2500 ... ... \u251c\u2500\u2500 index.html \u251c\u2500\u2500 package.json \u251c\u2500\u2500 vite.config.ts \u2514\u2500\u2500 wrangler.jsonc The Vite plugin informs Wrangler that this /dist directory contains the project\u2019s built static assets \u2014 which, in this case, includes client-side code, some CSS files, and images. Once deployed, this single-page application (SPA) architecture will look something like this: When a request comes in, Cloudflare looks at the pathname and automatically serves any static assets that match that pathname. For example, if your static assets directory includes a blog.html file, requests for example.com/blog get that file. Static sites If you have a static site created by a static site generator (SSG) like Astro , all you need to do is create a wrangler.jsonc file (or wrangler.toml ) and tell Cloudflare where to find your built assets: // wrangler.jsonc { \"name\": \"my-static-site\", \"compatibility_date\": \"2025-04-01\", \"assets\": { \"directory\": \"./dist\", } } Once you\u2019ve added this configuration, you can simply build your project and run wrangler deploy. Your entire site will then be uploaded and ready for traffic on Workers. Once deployed and requests start flowing in, your static site will be cached across Cloudflare\u2019s network . You can try starting a fresh Astro project on Workers today by running: npm create cloudflare@latest my-astro-app -- --framework=astro You can see our other supported Frameworks and how to get started in our framework guides . Single-page applications (SPAs) If you have a single-page application, you can explicitly enable single-page-application mode in your Wrangler configuration: { \"name\": \"example-spa-worker-hyperdrive\", \"main\": \"api/index.js\", \"compatibility_flags\": [\"nodejs_compat\"], \"compatibility_date\": \"2025-04-01\", }, \"assets\": { \"directory\": \"./dist\", \"binding\": \"ASSETS\", \"not_found_handling\": \"single-page-application\" }, \"hyperdrive\": [ { \"binding\": \"HYPERDRIVE\", \"id\": \"d9c9cfb2587f44ee9b0730baa692ffec\", \"localConnectionString\": \"postgresql://myuser:mypassword@localhost:5432/mydatabase\" } ], \"placement\": { \"mode\": \"smart\" } } By enabling this, the platform assumes that any navigation request (requests which include a Sec-Fetch-Mode: navigate header) are intended for static assets and will serve up index.html whenever a matching static asset match cannot be found. For non-navigation requests (such as requests for data) that don't match a static asset, Cloudflare will invoke the Worker script. With this setup, you can render the frontend with React, use a Worker to handle back-end operations, and use Vite to help stitch the two together. This is a great option for porting over older SPAs built with create-react-app , which was recently sunset . Another thing to note in this Wrangler configuration file: we\u2019ve defined a Hyperdrive binding and enabled Smart Placement . Hyperdrive lets us use an existing database and handles connection pooling. This solves a long-standing challenge of connecting Workers (which run in a highly distributed, serverless environment) directly to traditional databases. By design, Workers operate in lightweight V8 isolates with no persistent TCP sockets and a strict CPU/memory limit. This isolation is great for security and speed, but it makes it difficult to hold open database connections. Hyperdrive addresses these constraints by acting as a \u201cbridge\u201d between Cloudflare\u2019s network and your database, taking care of the heavy lifting of maintaining stable connections or pools so that Workers can reuse them. By turning on Smart Placement, we also ensure that if requests to our Worker originate far from the database (causing latency), Cloudflare can choose to relocate both the Worker\u2014which handles the database connection\u2014and the Hyperdrive \u201cbridge\u201d to a location closer to the database, \u200b\u200breducing round-trip times. SPA example: Worker code Let\u2019s look at the \u201cDeploy to Cloudflare\u201d example at the top of this blog. In api/index.js , we\u2019ve defined an API (using Hono) which connects to a hosted database through Hyperdrive. import { Hono } from \"hono\"; import postgres from \"postgres\"; import booksRouter from \"./routes/books\"; import bookRelatedRouter from \"./routes/book-related\"; const app = new Hono(); // Setup SQL client middleware app.use(\"*\", async (c, next) => { // Create SQL client const sql = postgres(c.env.HYPERDRIVE.connectionString, { max: 5, fetch_types: false, }); c.env.SQL = sql; // Process the request await next(); // Close the SQL connection after the response is sent c.executionCtx.waitUntil(sql.end()); }); app.route(\"/api/books\", booksRouter); app.route(\"/api/books/:id/related\", bookRelatedRouter); export default { fetch: app.fetch, }; When deployed, our app\u2019s architecture looks something like this: If Smart Placement moves the placement of my Worker to run closer to my database, it could look like this: Server-Side Rendering (SSR) If you want to handle rendering on the server, we support a number of popular full-stack frameworks . Here\u2019s a version of our previous example, now using React Router v7\u2019s server-side rendering: You could also use Next.js with the OpenNext adapter , or any other framework listed in our framework guides . Deploy to Workers, with as few changes as possible Node.js compatibility We\u2019ve also continued to make progress supporting Node.js APIs, recently adding support for the crypto , tls , net , and dns modules. This allows existing applications and libraries that rely on these Node.js modules to run on Workers. Let\u2019s take a look at an example: Previously, if you tried to use the mongodb package, you encountered the following error: Error: [unenv] dns.resolveTxt is not implemented yet! This occurred when mongodb used the node:dns module to do a DNS lookup of a hostname. Even if you avoided that issue, you would have encountered another error when mongodb tried to use node:tls to securely connect to a database. Now, you can use mongodb as expected because node:dns and node:tls are supported. The same can be said for libraries relying on node:crypto and node:net . Additionally, Workers now expose environment variables and secrets on the process.env object when the nodejs_compat compatibility flag is on and the compatibility date is set to 2025-04-01 or beyond. Some libraries (and developers) assume that this object will be populated with variables, and rely on it for top-level configuration. Without the tweak, libraries may have previously broken unexpectedly and developers had to write additional logic to handle variables on Cloudflare Workers. Now, you can just access your variables as you would in Node.js. const LOG_LEVEL = process.env.LOG_LEVEL || \"info\"; Additional Worker CPU time We have also raised the maximum CPU time per Worker request from 30 seconds to 5 minutes. This allows for compute-intensive operations to run for longer without timing out. Say you want to use the newly supported node:crypto module to hash a very large file, you can now do this on Workers without having to rely on external compute for CPU-intensive operations. Workers Builds We\u2019ve also made improvements to Workers Builds , which allows you to connect a Git repository to your Worker, so that you can have automatic builds and deployments on every pushed change. Workers Builds was introduced during Builder Day 2024 , and initially only allowed you to connect a repository to an existing Worker. Now, you can bring a repository and immediately deploy it as a new Worker , reducing the amount of setup and button clicking needed to bring a project over. We\u2019ve improved the performance of Workers Builds by reducing the latency of build starts by 6 seconds \u2014 they now start within 10 seconds on average. We also boosted API responsiveness, achieving a 7x latency improvement thanks to Smart Placement. Note : On April 2, 2025, Workers Builds transitioned to a new pricing model, as announced during Builder Day 2024 . Free plan users are now capped at 3,000 minutes of build time, and Workers Paid subscription users will have a new usage-based model with 6,000 free minutes included and $0.005 per build minute pricing after. To better support concurrent builds, Paid plans will also now get six (6) concurrent builds, making it easier to work across multiple projects and monorepos. For more information on pricing, see the documentation . You can also set up Workers Builds to run on non-production branches , and preview URLs will be posted back to GitHub as a comment . Bind the Images API to your Worker Last week, we wrote a blog post that covers how the Images binding enables more flexible, programmatic workflows for image optimization. Previously, you could access image optimization features by calling fetch() in your Worker. This method requires the original image to be retrievable by URL. However, you may have cases where images aren\u2019t accessible from a URL, like when you want to compress user-uploaded images before they are uploaded to your storage. With the Images binding, you can directly optimize an image by operating on its body as a stream of bytes. To learn more, read our guide on transforming an image before it gets uploaded to R2 . Start building today We\u2019re excited to see what you\u2019ll build, and are focused on new features and improvements to make it easier to create any application on Workers. Much of this work was made even better by community feedback, and we encourage everyone to join our Discord to participate in the discussion. Helpful resources to get you started: Framework guides Migration guide Static assets documentation Cloudflare Vite plugin documentation Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Developer Week Developers Front End Full Stack General Availability Cloudflare Pages Cloudflare Workers MySQL Hyperdrive",
+    "quality_score": 8,
+    "modules": [
+      "js_advanced",
+      "architecture_patterns",
+      "dx"
+    ]
   }
 ]

```

### Commit 2: 5121589
**Message:** feat: expand curated seed corpus batch

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index 5318fe8..0b74b2c 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -60,3 +60,11 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 59,track2,java_patterns,"performance,devops",https://quarkus.io/blog/continued-focus-on-native/,"Continued Focus on Native","Quarkus Blog","Severin Gehwolf",2025-11-03,8,"Quarkus explains its long-term native strategy, startup and memory tradeoffs, and how Mandrel evolution supports cloud-native Java workloads.",kept,,
 60,track2,java_patterns,"performance,evolutionary",https://quarkus.io/blog/leyden-2/,"How we integrated Project Leyden into Quarkus","Quarkus Blog","Guillaume Smet; Georgios Andrianakis",2026-03-05,8,"Strong JVM evolution post on integrating Project Leyden into Quarkus while balancing startup performance, native image, and operational simplicity.",kept,,
 61,track2,dependency_health,security,https://github.blog/security/supply-chain-security/understand-your-softwares-supply-chain-with-githubs-dependency-graph/,"Understand your software’s supply chain with GitHub’s dependency graph","The GitHub Blog","Andrea Griffiths",2025-07-01,8,"A focused supply-chain article on direct and transitive dependencies, dependency graphs, and how teams keep dependency risk visible before it becomes an incident.",kept,,
+62,track2,concurrency,"complexity,elixir_patterns",https://dashbit.co/blog/remix-concurrent-submissions-flawed,"Remix's concurrent submissions are fundamentally flawed (without causal ordering)","Dashbit Blog","José Valim",2024-09-12,9,"A sharp concurrency and state-ordering write-up that makes race conditions concrete with timelines, database reads, and causal-ordering alternatives.",kept,,
+63,track2,security,"elixir_patterns,dx",https://dashbit.co/blog/zero-trust-for-plug-phoenix,"Zero Trust Auth for Plug/Phoenix apps is here","Dashbit Blog","José Valim",2025-12-16,8,"Useful practical article on adding zero-trust authentication to Plug/Phoenix apps without rolling bespoke auth glue, grounded in production Livebook usage.",kept,,
+64,track2,type_system,"python_patterns,concurrency",https://engineering.fb.com/2025/05/05/developer-tools/enhancing-the-python-ecosystem-with-type-checking-and-free-threading/,"Enhancing the Python ecosystem with type checking and free threading","Engineering at Meta","Danny Yang; Matt Page; Aaron Pollack",2025-05-05,9,"Strong Python tooling article that connects type-checker ergonomics with free-threaded Python and concrete ecosystem work on pandas and numpy.",kept,,
+65,track2,java_patterns,"performance,complexity",https://quarkus.io/blog/new-benchmarks/,"Quarkus has great performance – and we have new evidence","Quarkus Blog","Holly Cummins",2026-03-02,8,"A stronger Java-platform entry than the release note: it explains benchmark design, throughput, startup, and memory tradeoffs with enough detail to ground real architecture decisions.",kept,,
+66,track2,architecture_patterns,"performance,error_resilience",https://github.blog/engineering/architecture-optimization/how-we-improved-push-processing-on-github/,"How we improved push processing on GitHub","The GitHub Blog","Will Haltom",2024-06-11,8,"Good architecture-at-scale write-up on the hidden fan-out behind git push and how GitHub made critical post-push processing more reliable and complete.",kept,,
+67,track2,performance,"integration,complexity",https://www.linkedin.com/blog/engineering/infrastructure/optimizing-linkedin-sales-navigators-search-pipeline-with-spark,"Optimizing LinkedIn Sales Navigator’s search pipeline with Spark","LinkedIn Engineering Blog","Chunxu Tang; Yanji Jia; Puneet Singh Ahluwalia; Yuou Lei",2025-07-23,8,"A production data-pipeline optimization story with concrete runtime wins while migrating a 100+ job search-index build from MapReduce to Spark.",kept,,
+68,track2,architecture_patterns,"error_resilience,performance",https://www.linkedin.com/blog/engineering/infrastructure/rethinking-hfds-block-placement-for-exabyte-scale-clusters,"Scaling maintenance: Rethinking HDFS block placement for exabyte-scale clusters","LinkedIn Engineering Blog","Ponmani Palanisamy",2026-01-22,9,"Excellent large-scale infrastructure article on redesigning block placement and maintenance workflows across exabyte-scale HDFS clusters under strict availability constraints.",kept,,
+69,track2,security,"architecture_patterns,devops",https://www.linkedin.com/blog/engineering/infrastructure/securing-every-kubernetes-workload-at-scale,"Securing every Kubernetes workload at scale","LinkedIn Engineering Blog","Rahul Godha; Yogesh Patil",2026-02-26,9,"High-signal platform security post on workload identity, cert-manager scaling, and stronger trust guarantees across large multi-cluster Kubernetes fleets.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index 2ddd115..e0527b7 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -728,5 +728,101 @@
       "security",
       "dependency_health"
     ]
+  },
+  {
+    "url": "https://dashbit.co/blog/remix-concurrent-submissions-flawed",
+    "title": "Remix's concurrent submissions are fundamentally flawed (without causal ordering)",
+    "source_name": "Dashbit Blog",
+    "text": "Jos\u00e9 Valim September 12th, 2024 concurrency , liveview I have recently heard that ChatGPT launched a new version of its UI, using Remix, so I decided to give it a try and chase some UI/UX bugs. One of the motivations for this is because I consider Remix to be a library/framework trying to further integrate client and server, similar to Phoenix LiveView, but with different trade-offs. As I dug deeper, I realized that the trade-offs made by Remix\u2019s submission and revalidation are flawed and they cannot reliably deliver the properties outlined in their concurrency page for the majority of applications (if not all). Submission and revalidation With submission and revalidation is the idea that, if you submit a form, press a button, or anything that may lead to a POST/PATCH/DELETE on the server, you will first submit a request and then you do another request to load the data. The first obvious issue with this approach is that, for any mutation, you are doing two round-trips to the server. For example, ChatGPT\u2019s UI does perform two round-trips and the lag is quite noticiable. The two most common reasons I have heard for going down this route are: It supports workflows with no JavaScript. However, in ChatGPT\u2019s case, that\u2019s not a possibility. So why pay the price for a feature that is not there? It benefits caching. Which is partially pointless: why am I paying the price of two requests for the possibility of eventually using the cached value in the future? Why not do a single request and, if I need to read the data again, then I cache it? Anyway, assuming you are fine with paying the price of two round-trips, Remix documentation says that it allows concurrent submissions and that Remix \u201csafeguards against potential pitfalls by refraining from committing stale data when other actions introduce race conditions\u201d. Unfortunately, that\u2019s not quite true. Hello Database Remix documentation includes diagrams with some examples of how they deal with network requests. Let\u2019s build on top of them. In particular, they use the following keys: |: Submission begins \u2713: Action complete, data revalidation begins \u2705: Revalidated data is committed to the UI \u274c: Request cancelled And here is one example they show: submission 1: |----\u2713-----\u2705 submission 2: |-----\u2713-----\u2705 submission 3: |-----\u2713-----\u2705 There is a wrong assumption in here: it assumes that the revalidation that finishes first, contains an earlier version of the data. Given that most Remix applications interact with a database, let\u2019s add a new key, called R , which is when the revalidation reads from the database. Most people would expect it to always run like this: submission 1: |----\u2713--R-----------------\u2705 submission 2: |-----\u2713--R----------------\u2705 submission 3: |-----\u2713--R---------\u2705 But the following is also a possible execution: submission 1: |----\u2713---------------R----\u2705 submission 2: |-----\u2713--R----------------\u2705 submission 3: |-----\u2713------R-----\u2705 As you can see above, R1 will see all submissions, and that will be reflected in the UI. But R2 won\u2019t see the effects of the third submission, reverting the UI to a previous state, only for it to correct itself once again. Let\u2019s make things more concrete. Imagine you have a table with three rows. Each row has a delete button. If you delete the three rows one after the other, you will issue three submission, one to delete each row. If these submissions follow the diagram above, here is what we will see. On the revalidate step, submission 1 will see all rows deleted, removing them from the page. The submission 2 comes in, and brings the third row back to life, only for it to be removed again. In this particular example, you could somehow track that the third row has been removed permanently using client-side logic, but for any non-trivial case, a submission will affect too many different properties and UI elements, making it hard to keep client and server state in sync. Overall, the assumption that the first response has an earlier version of the data is wrong for concurrent requests and Remix does not safeguard from these race conditions. The safest thing for Remix to do is to issue the revalidation only after all submissions completed, which may further penalize the user experience by stalling updates until the last one arrives: submission 1: |----\u2713 submission 2: |-----\u2713 submission 3: |-----\u2713------R-----\u2705 In fact, you cannot even guarantee the submissions are processed in order! It may be that submission 2 updates the database before submission 1! If the concurrent submissions modify overlapping resources in the database, there is no guarantee the last submission sent by the user will be the last one applied by the server, unless the submissions converge or are made serial. So not only it may show the wrong data, it may also persist stale data to the database. Intermission: Q&A At this point, you may have several questions and suggestions, so let\u2019s get some of the quick ones out of the way, before we jump into the big one. Q: Couldn\u2019t I store locally that an item has been updated/deleted? Yes, you can definitely do that, and that\u2019s what I assume most client frameworks are doing. This issue above arises from the \u201csubmission and revalidation\u201d approach, especially when the properties returned by the server are out-of-sync with the client changes (spoiler alert: single fetch mutation is worse). Of course, you could start tracking the updates and deletes in your Remix app as well, to keep your UI consistent, but then why bother with \u201csubmission and revalidation\u201d in the first place, if you cannot trust the properties returned by the server? Q: What if I disallow double submissions? The issues described here can also happen when deleting two entries in the same table . So you would have to block all interactions within the table/component. Blocking the user from using your UI because your framework cannot deal with concurrent requests is the opposite of good UX/DX. Q: Isn\u2019t the submission and revalidate pattern, as described, eventually consistent? Not quite. The pattern is eventually consistent in the sense that you will eventually have the same version as the server, but we should not expect an eventually consistent system to return data which we have previously seen as deleted. Q: Can the scenario above actually happen? A typical web request will pass through proxies, load balancers/gateways, then be thrown into JavaScript\u2019s event loop, garbage collectors, then the database connection polling and any transaction locking your database may use. And then make its way back. If a single iteration of your event loop blocks for too long, for example, by decoding/encoding large JSON payloads, that\u2019s enough to shuffle the order around. You should also consider the fallacies of distributed systems . Those provide plenty of opportunities for your requests and responses to be processed out of order. What about single fetch/round-trip mutation? The first time I brought up the latency issues from submission and revalidation, a common response was: you can do a single request instead! And while I agree a single request would be preferrable, it is worth pointing out that they do not solve the underlying problem. In fact, single fetch mutations will worsen stale data issues . A simple way to think about it is that, under the submission and revalidate pattern, you are guaranteed to have at least one read request after all three submissions, but this guarantee is gone under single fetch. Let\u2019s see some diagrams, starting with the keys: |: Submission begins U: Submission updated/deleted R: Data read \u2705: Revalidated data is committed to the UI This is how most people would expect it to behave: submission 1: |----U--R---\u2705 submission 2: |----U--R---\u2705 submission 3: |----U--R---\u2705 But submission 2 could be delayed and you end-up with this: submission 1: |----U--R---\u2705 submission 2: |--------------U--R---\u2705 submission 3: |----U--R---------------\u2705 If you assume the last submission is correct, it will show the result of submission 3 in the UI, but the server state is actually the one from submission 2. While users may see stale data in web applications when another user changes it, a user must not see stale data that they submitted themselves , and the above is just one possible variation of what may actually happen. Since each request is now update/deleting the data and then reading it, you still cannot know nor guarantee which submission read the actual latest version of the data, even if you do it all inside a transaction. For example, PostgreSQL does not guarantee that a transaction T1, that was started before T2, will commit before T2. So the potential for showing stale data is even greater here. The simplest way to address these issues is to disable concurrent requests and deal with its impact in the user experience, as shown next: submission 1: |----U--R---\u2705 submission 2: |----U--R---\u2705 submission 3: |----U--R---\u2705 Perhaps we could do better? In search of solutions It is generally not possible to know the order a transaction will be committed within the transaction itself, except by making transactions serializable, which would cause a huge impact on performance. You could use something akin to PostgreSQL\u2019s pg_current_snapshot() to tell you which transactions are currently running, and that can give you some feedback, but if the three transactions from the three submissions overlap each other, it doesn\u2019t provide enough information to solve the problem. Someone may also consider using sticky sessions/server affinity to guarantee the submissions are sent to the same instance and processed in order, but you still have to deal with the event loop and guarantee that the database will start and end transactions in order which, once again, can be only achieved by serializing all database transactions, drastically impacting performance. Remix\u2019s own documentation mentions the potential of stale data and one of the solutions they suggest is to include timestamps in the form and compare them on the server, updating entries only if updated_at < requested_at . However, that\u2019s not enough unless you are also locking rows, which pushes complexity to all server updates and introduces the possibility of deadlocks. The simplest solution I can think about this problem requires at least causal ordering (but I may have missed simpler models ). Solution #1: causal ordering The idea with causal ordering is that, if I perform three submissions, #1, #2, and #3, the submission #2 should carry with itself the information that it depends on the execution of submission #1. And submission #3 depends on #2. Assuming we are using sticky sessions, we can now route all requests to the same Node.js instance. Then, you can make it so submission #2 blocks until submission #1 is completed, using some eventing system within the JavaScript runtime, to guarantee they are processed in the correct order. On the other hand, because the server may receive submission #2 after submission #1 has been fully completed, the notification that submission #1 has completed may already have been emitted. To address this, the server would need to keep a log of all completed submissions within a time period. The benefit of this approach is that the client can fire requests immediately and the server can also send concurrent responses, as long as it orders the updates and reads within: submission 1: |----U--R---\u2705 submission 2: |----U--R---\u2705 submission 3: |----U--R---\u2705 Of course, response for submission #2 may still arrive earlier than submission #1, but because the server has ordered them, it is completely safe to ignore the result of submission #1. While I believe this would solve the problem, it comes with the complexity of ordering concurrent events by keeping history in each Node.js process and you still can only deploy it to infrastructure that supports sticky sessions. One possible alternative to sticky sessions, suggested by Dev Agrawal, is to use database transactions and locks to maintain the causal order. Each client gets a database row with the last submission ID, and a submission may only continue if the relevant last submission ID has been committed. Locks would be used to ensure submissions from the same client are not processed concurrently by the server. This approach requires you to hold a transactional lock for the duration of each request, which may put additional pressure on your database pool and increase the likelihood of deadlocks if any locking mechanism is used within your application for actual data integrity. The overall implementation, feasibility, and costs will depend on the database of choice. Solution #2: persistence all the way Another solution, which is the one employed by Phoenix LiveView , is to keep an open connection between the client and the server, using WebSockets . This way, all events are received and can be processed in order, which guarantees the database reads and all updates will be delivered in order (but you can also easily process them concurrently when using Elixir, if you deem it safe to do so). One potential caveat here is the requirement to use WebSockets. Of course, you can always fallback to long-polling\u2026 or can you? The issue with long-polling is that you are back to issuing separate HTTP requests, which can be routed to different servers, and now we are back to needing sticky sessions and some causal ordering between the requests (which is exactly solution #1 outlined above). Therefore you may be wondering: how does Phoenix LiveView solves this? I am glad you asked! When you start a long polling connection in LiveView, imagine it goes to Server #1, LiveView starts a lightweight Erlang VM process (you can literally spawn million of those) to be responsible for that particular session, and assign a session identifier to it. Once the long polling request concludes, we include the session identifier in the response. Now when the client does the next long polling request, it may go to Server #2, but it also includes the session identifier. Because Phoenix runs on top of the Erlang VM, it uses the Erlang Distribution to find the process in the other node, preserving the persistence property we are interested in! I actually recommend checking out the long polling implementation in Phoenix, since this is all achieved with ~450 lines of code ( here and here ). Unfortunately, if you do not have async processing nor distribution channel readily accessible, there is a reasonable amount of work required to enable persistent connections with long polling. Of course, you could always try to bring another service (paid or self-hosted), but I am drawing a line at bringing in additional complexity and services just to guarantee a framework won\u2019t serve stale data or race updates. We still have to talk about cancelled submissions So far, we have explored the downsides of the \u201csubmission and revalidation\u201d approach. It causes the user experience to lag unnecesarily and Remix, in particular, does not deliver on the promise of safeguarding most applications from race conditions. However, it is worth noting Remix may also cancel submissions, which can become a massive problem. First of all, you can only cancel a submission in favor of a subsequent one if they are idempotent . While we ideally want to implement endpoints as idempotent whenever possible, in my opinion, it is too high of an assumption (or requirement) for a web framework to impose by default. The biggest issue is that a cancelled request may still be received by the server, and based on everything we discussed, be processed after the subsequent submission. Remix actually recognizes this in their documentation with the following diagram: \ud83d\udc47 interruption with new submission |----\u274c----------------------\u2713 |-------\u2713-----\u2705 \ud83d\udc46 initial request reaches the server after the interrupting submission has completed revalidation But then they proceed to dismiss this scenario as an issue only possible with \u201cinconsistent infrastructure\u201d. It happens that your network and infrastructure won\u2019t be homogenous and they don\u2019t consider that, after a request is sent, it will pass through proxies, load balancers/gateways, then be thrown into JavaScript\u2019s event loop and garbage collector, then the database connection polling and any transaction locking your database may use before it performs any write. So even if you are willing to accept the double round-trip of \u201csubmission and revalidation\u201d, its race conditions (or lack of concurrency if they so choose to disable the feature), you still have to contend with the fact that your users may see stale data immediately after a submission . Which can go from minor UI nuisances to leading them to wrong decisions, such as clicking on \u201cBuy Now\u201d thinking a particular order had 2 line items, but the server actually stored 3 thanks to a \u201ccancelled\u201d submission. While this particular problem could happen in web applications written 20 years ago, for example by double submitting a form, a library that encourages users to rely on concurrent requests and active cancellation without the appropriate safeguards may make this problem more frequent. I also believe we should aim to improve on the limitations of the past, rather than reaffirm them. Luckily, introducing causal ordering (or persistence), would fully address this problem too. Overall, I hope this article shows that, if you are going to use the server state to drive the UI, concurrent submissions can be the source of pitfalls, race conditions, and inconsistencies, which can be addressed by introducing causal ordering.",
+    "quality_score": 9,
+    "modules": [
+      "concurrency",
+      "complexity",
+      "elixir_patterns"
+    ]
+  },
+  {
+    "url": "https://dashbit.co/blog/zero-trust-for-plug-phoenix",
+    "title": "Zero Trust Auth for Plug/Phoenix apps is here",
+    "source_name": "Dashbit Blog",
+    "text": "Jos\u00e9 Valim December 16th, 2025 plug , phoenix At Dashbit, we help startups and enterprises adopt and grow their Elixir teams. We are the creators of Elixir, Nx, and Livebook, and also maintainers of Phoenix, Ecto, and LiveView. We work with a limited number of clients and use our shared experiences to improve the Elixir ecosystem, creating libraries like Broadway and many of the our \u201cnimble\u201d libraries, as the one we will share in this article. Get in touch to learn how our team of experts can take your use of Elixir to the next level. We have just released nimble_zta , a library that allows developers to add Zero Trust Auth (ZTA) to their Plug/Phoenix web apps. Imagine you are building a web application to run inside your private cloud, except that you don\u2019t want to expose it to your whole organization. Your company likely already has identity and access control systems in place and trying to roll your own integration will be time-consuming and error-prone. With Zero Trust Auth, you use your cloud provider to identify and control access to the application. The cloud provider acts as a proxy, performing authentication and authorization according to predefined rules, and forwards the relevant credentials to your application. All identity management is handled for you and you can focus on your business logic. nimble_zta is a collection of zero trust strategies for different providers. CloudFlare, Google Cloud Platform, and Tailscale are currently supported, with additional HTTP Basic Auth and Pass Through strategies available for development and testing. Read the docs for more information . Support additional providers is relatively straight-forward and pull requests are certainly welcome! This library was extracted from Livebook , where many companies use our Zero Trust strategies to deploy notebooks as internal apps and turn Livebook into a controlled environment for runbooks and production operations. Nimble libraries nimble_zta is the latest addition to our collection of \u201cnimble\u201d libraries. The nimble family from Dashbit includes: NimbleCSV - simple and fast CSV parsing NimbleOptions - tiny library for validating and documenting high-level options NimbleOwnership - track resource ownership across processes NimbleParsec - simple and fast parser combinators NimblePool - tiny resource-pool implementation NimblePublisher - a minimal filesystem-based publishing engine with Markdown support and code highlighting (used to power this blog!) NimbleTOTP - tiny library for generating time-based one time passwords (TOTP) NimbleZTA - add Zero Trust Auth (ZTA) to web apps running in your private cloud Something went wrong with your subscription. Please try again. You have been successfully subscribed.",
+    "quality_score": 8,
+    "modules": [
+      "security",
+      "elixir_patterns",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://engineering.fb.com/2025/05/05/developer-tools/enhancing-the-python-ecosystem-with-type-checking-and-free-threading/",
+    "title": "Enhancing the Python ecosystem with type checking and free threading",
+    "source_name": "Engineering at Meta",
+    "text": "Meta and Quansight have improved key libraries in the Python Ecosystem. There is plenty more to do and we invite the community to help with our efforts. We\u2019ll look at two key efforts in Python\u2019s packaging ecosystem to make packages faster and easier to use: \ud83d\ude80 Unlock performance wins for developers through free-threaded Python \u2013 where we leverage Python 3.13\u2019s support for concurrent programming (made possible by removing the Global Interpreter Lock (GIL)). \u2705 Increase developer velocity in the IDE with improved type annotations. Enhancing typed Python in the Python scientific stack Type hints, introduced in Python 3.5 with PEP-484 , allow developers to specify variable types, enhancing code understanding without affecting runtime behavior. Type-checkers validate these annotations, helping prevent bugs and improving IDE functions like autocomplete and jump-to-definition. Despite their benefits, adoption is inconsistent across the open source ecosystem, with varied approaches to specifying and maintaining type annotations. The landscape of open source software is fractured with respect to how type annotations are specified, maintained, and distributed to end users. Some projects have in-line annotations (types directly declared in the source code directly), others keep types in stub files, and many projects have no types at all, relying on third party repositories such as typeshed to provide community-maintained stubs. Each approach has its own pros and cons, but application and maintenance of them has been inconsistent . Meta and Quansight are addressing this inconsistency through: Direct contributions: We have improved the type coverage for pandas-stubs and numpy, and are eager to expand the effort to more packages. Community engagement: Promoting type annotation efforts to encourage community involvement, listen to feedback and create actionable ways to improve the ecosystem. Tooling and automation: Developing tools to address common challenges adding types and keeping the types up-to-date with the source code. Improved type annotations in pandas TL;DR: Pandas is the second most downloaded package from the Python scientific stack. We improved pandas-stubs package type annotation coverage from 36% to over 50%. Background The pandas community maintains its own stubs in a separate repository, which must be installed to obtain type annotations. While these stubs are checked separately from the source code, it allows the community to use types with their own type checking and IDE. Improving type coverage When we began our work in pandas-stubs, coverage was around 36%, as measured by the percentage of parameters, returns, and attributes that had a complete type annotation (the annotation is present and all generics have type arguments). After several weeks of work and about 30 PRs, type completeness is now measured at over 50%. The majority of our contributions involved adding annotations to previously-untyped parameters, adding type arguments to raw generic types, and removing deprecated/undocumented interfaces. We also improved several inaccurate annotations and updated others to match the inline annotations in the pandas source code. Key introductions Two key introductions significantly increased coverage: Replacing raw Series types with UnknownSeries , a new type aliased to Series[Any] . When applied to return type annotations, this reduces the number of type checker false-positives when the function is called. Improving types of core Dataframe operations like insert, combine, replace, transpose, and assign, as well as many timestamp and time-zone related APIs. Tooling development In addition to improving coverage directly, we developed tooling to catalog public interfaces missing annotations. We also augmented our tools for measuring type coverage to handle the situation where stubs are distributed independently, rather than being packaged into the core library wheel. What is free-threaded Python ? Free-threaded Python (FTP) is an experimental build of CPython that allows multiple threads to interact with the VM in parallel. Previously, access to the VM required holding the global interpreter lock (GIL), thereby serializing execution of concurrently running threads. With the GIL becoming optional, developers will be able to take full advantage of multi-core processors and write truly parallel code. Benefits of free-threaded Python The benefits of free-threaded Python are numerous: True parallelism in a single process : With the GIL removed, developers can write Python code that takes full advantage of multi-core processors without needing to use multiple processes. CPU-bound code can execute in parallel across multiple cores. Improved performance: By allowing multiple threads to execute Python code simultaneously, work can be effectively distributed across multiple threads inside a single process. Simplified concurrency: Free-threading provides developers with a more ergonomic way to write parallel programs in Python. Gone are the days of needing to use multiprocessing.Pool and/or resorting to custom shared memory data structures to efficiently share data between worker processes. Getting Python\u2019s ecosystem ready for FTP The ecosystem of Python packages must work well with free-threaded Python in order for it to be practically useful; application owners can\u2019t use free-threading unless their dependencies work well with it. To that end, we have been taking a \u201cbottoms up\u201d approach to tackle the most difficult/popular packages in the ecosystem. We\u2019ve added free-threading support to many of the most popular packages used for scientific computing (e.g. numpy, scipy, scikit-learn) and language bindings (e.g. Cython, nanobind, pybind, PyO3). Just getting started Together, we made substantial progress in improving type annotations and free-threading compatibility in Python libraries. We couldn\u2019t have done it without the Python community and are asking others to join our efforts. Whether it\u2019s further updates to the type annotations or preparing your code for FTP , we value your help moving the Python ecosystem forward! To learn more about Meta Open Source, visit our open source site , subscribe to our YouTube channel , or follow us on Facebook , Threads , X and LinkedIn .",
+    "quality_score": 9,
+    "modules": [
+      "type_system",
+      "python_patterns",
+      "concurrency"
+    ]
+  },
+  {
+    "url": "https://github.blog/engineering/architecture-optimization/how-we-improved-push-processing-on-github/",
+    "title": "How we improved push processing on GitHub",
+    "source_name": "The GitHub Blog",
+    "text": "What happens when you push to GitHub ? The answer, \u201cMy repository gets my changes\u201d or maybe, \u201cThe refs on my remote get updated\u201d is pretty much right\u2014and that is a really important thing that happens, but there\u2019s a whole lot more that goes on after that. To name a few examples: Pull requests are synchronized, meaning the diff and commits in your pull request reflect your newly pushed changes. Push webhooks are dispatched. Workflows are triggered. If you push an app configuration file (like for Dependabot or GitHub Actions), the app is automatically installed on your repository. GitHub Pages are published. Codespaces configuration is updated. And much, much more. Those are some pretty important things, and this is just a sample of what goes on for every push. In fact, in the GitHub monolith, there are over 60 different pieces of logic owned by 20 different services that run in direct response to a push. That\u2019s actually really cool\u2014we should be doing a bunch of interesting things when code gets pushed to GitHub. In some sense, that\u2019s a big part of what GitHub is, the place you push code 1 and then cool stuff happens. The problem What\u2019s not so cool is that, up until recently, all of these things were the responsibility of a single, enormous background job. Whenever GitHub\u2019s Ruby on Rails monolith was notified of a push, it enqueued a massive job called the RepositoryPushJob . This job was the home for all push processing logic, and its size and complexity led to many problems. The job triggered one thing after another in a long, sequential series of steps, kind of like this: There are a few things wrong with this picture. Let\u2019s highlight some of them: This job was huge, and hard to retry. The size of the RepositoryPushJob made it very difficult for different push processing tasks to be retried correctly. On a retry, all the logic of the job is repeated from the beginning, which is not always appropriate for individual tasks. For example: Writing Push records to the database can be retried liberally on errors and reattempted any amount of time after the push, and will gracefully handle duplicate data. Sending push webhooks, on the other hand, is much more time-sensitive and should not be reattempted too long after the push has occurred. It is also not desirable to dispatch multiples of the same webhook. Most of these steps were never retried at all. The above difficulties with conflicting retry concerns ultimately led to retries of RepositoryPushJob being avoided in most cases. To prevent one step from killing the entire job, however, much of the push handling logic was wrapped in code catching any and all errors. This lack of retries led to issues where crucial pieces of push processing never occurred. Tight coupling of many concerns created a huge blast radius for problems. While most of the dozens of tasks in this job rescued all errors, for historical reasons, a few pieces of work in the beginning of the job did not. This meant that all of the later steps had an implicit dependency on the initial parts of the job. As more concerns are combined within the same job, the likelihood of errors impacting the entire job increases. For example, writing data to our Pushes MySQL cluster occurred in the beginning of the RepositoryPushJob . This meant that everything occurring after that had an implicit dependency on this cluster. This structure led to incidents where errors from this database cluster meant that user pull requests were not synchronized, even though pull requests have no explicit need to connect to this cluster. A super long sequential process is bad for latency. It\u2019s fine for the first few steps, but what about the things that happen last? They have to wait for every other piece of logic to run before they get a chance. In some cases, this structure led to a second or more of unnecessary latency for user-facing push tasks, including pull request synchronization. What did we do about this? At a high level, we took this very long sequential process and decoupled it into many isolated, parallel processes. We used the following approach: We added a new Kafka topic that we publish an event to for each push. We examined each of the many push processing tasks and grouped them by owning service and/or logical relationships (for example, order dependency, retry-ability). For each coherent group of tasks, we placed them into a new background job with a clear owner and appropriate retry configuration. Finally, we configured these jobs to be enqueued for each publish of the new Kafka event. To do this, we used an internal system at GitHub that facilitates enqueueing background jobs in response to Kafka events via independent consumers. We had to make investments in several areas to support this architecture, including: Creating a reliable publisher for our Kafka event\u2013one that would retry until broker acknowledgement. Setting up a dedicated pool of job workers to handle the new job queues we\u2019d need for this level of fan out. Improving observability to ensure we could carefully monitor the flow of push events throughout this pipeline and detect any bottlenecks or problems. Devising a system for consistent per-event feature flagging, to ensure that we could gradually roll out (and roll back if needed) the new system without risk of data loss or double processing of events between the old and new pipelines. Now, things look like this: A push triggers a Kafka event, which is fanned out via independent consumers to many isolated jobs that can process the event without worrying about any other consumers. Results A smaller blast radius for problems. This can be clearly seen from the diagram. Previously, an issue with a single step in the very long push handling process could impact everything downstream. Now, issues with one piece of push handling logic don\u2019t have the ability to take down much else. Structurally, this decreases the risk of dependencies. For example, there are around 300 million push processing operations executed per day in the new pipeline that previously implicitly depended on the Pushes MySQL cluster and now have no such dependency, simply as a product of being moved into isolated processes. Decoupling also means better ownership. In splitting up these jobs, we distributed ownership of the push processing code from one owning team to 15+ more appropriate service owners. New push functionality in our monolith can be added and iterated on by the owning team without unintentional impact to other teams. Pushes are processed with lower latency. By running these jobs in parallel, no push processing task has to wait for others to complete. This means better latency for just about everything that happens on push. For example, we can see a notable decrease in pull request sync time: Improved observability. By breaking things up into smaller jobs, we get a much clearer picture of what\u2019s going on with each job. This lets us set up observability and monitoring that is much more finely scoped than anything we had before, and helps us to quickly pinpoint any problems with pushes. Pushes are more reliably processed. By reducing the size and complexity of the jobs that process pushes, we are able to retry more things than in the previous system. Each job can have retry configuration that\u2019s appropriate for its own small set of concerns, without having to worry about re-executing other, unrelated logic on retry. If we define a \u201cfully processed\u201d push as a push event for which all the desired operations are completed with no failures, the old RepositoryPushJob system fully processed about 99.897% of pushes. In the worst-case estimate, the new pipeline fully processes 99.999% of pushes. Conclusion Pushing code to GitHub is one of the most fundamental interactions that developers have with GitHub every day. It\u2019s important that our system handles everyone\u2019s pushes reliably and efficiently, and over the past several months we have significantly improved the ability of our monolith to correctly and fully process pushes from our users. Through platform level investments like this one, we strive to make GitHub the home for all developers (and their many pushes!) far into the future. Notes People push to GitHub a whole lot, as you can imagine. In the last 30 days, we\u2019ve received around 500 million pushes from 8.5 million users. \u21a9 Written by Related posts Explore more from GitHub Docs Everything you need to master GitHub, all in one place. Go to Docs GitHub Universe 2024 Get tickets to the 10th anniversary of our global developer event on AI, DevEx, and security. Get tickets GitHub Copilot Don\u2019t fly solo. Try 30 days for free. Learn more Enterprise content Executive insights, curated just for you Get started",
+    "quality_score": 8,
+    "modules": [
+      "architecture_patterns",
+      "performance",
+      "error_resilience"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/optimizing-linkedin-sales-navigators-search-pipeline-with-spark",
+    "title": "Optimizing LinkedIn Sales Navigator\u2019s search pipeline with Spark",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Infrastructure Optimizing LinkedIn Sales Navigator\u2019s search pipeline with Spark Enterprise-grade data pipelines are often complex, time-consuming, and resource-intensive, making performance optimization a significant challenge. At LinkedIn, we shifted separated search use cases to a centralized hosted search service , known as search-as-a-service. One of the largest use cases is the search system for LinkedIn Sales Navigator , which leverages AI to identify prospects, enhance engagement, and elevate conversations. During this migration, we also transitioned the data manipulation (DM) pipeline for search index building from MapReduce to Spark and significantly tuned and improved the Spark jobs\u2019 efficiency. In this blog post, we\u2019ll share insights gained from optimizing this intricate Spark-based data manipulation pipeline\u2014which comprises over 100 DM jobs\u2014and how we successfully reduced the total execution time from 6 - 7 hours to around three hours. This performance optimization enables LinkedIn Sales Navigator customers to benefit from quicker access to updated search results, facilitating more timely and informed decision-making. Overview of the search system powering Sales Navigator The search system we discuss in this article is a foundational layer powering various product surfaces across Sales Navigator, such as Lead Search, Relationship Explorer, Saved Lead Searches, Persona, Lead Lists, Lead Recommendations in Account Hub, and many others. This search system contains three primary components: offline, nearline, and serving, as illustrated in the figure below. Figure 1. High-level design of the search system powering Sales Navigator The offline component involves periodic large-scale batch processing jobs that load input datasets from Hadoop Distributed File System (HDFS) , transform them into derived datasets, and build base indexes for search. These base indexes are immutable and stored in shards, with all postings of an inverted list sorted by their document IDs. We heavily utilize Spark for offline jobs. The offline component generates watermarks (timestamps in epoch milliseconds) that indicate the time before which all updates for the dataset are captured in the snapshot produced by the offline pipeline and included in the base index. In contrast, the nearline component applies stream processing techniques to capture updates occurring after the watermark and build a live index from real-time events. This live index is stored in memory and periodically flushed to disk as snapshots, referred to as the middle index. On the serving side, when a query is received, it goes through a mid-tier that functions as a federation layer, forwarding the query to the appropriate search servers. These servers translate the query and send it to the broker. Each broker is responsible for distributing the request across various partitions of searchers and then aggregating and merging the results. Each searcher handles a single shard of the index, receiving requests from the broker and retrieving matching entities from the index. The entities are scored, and the highest-scoring entities are returned. We have two groups of serving clusters: live clusters which serve production traffic and dark clusters which are leveraged as dark canary in the automated deployment workflow. There is a response validator that compares responses between live and dark clusters. Data manipulation jobs Sales Navigator\u2019s data manipulation pipeline includes over 100 jobs, with the largest Spark-based job requiring approximately 5,000 executors to run. Each job reads datasets in Avro format from storage systems like HDFS, so after processing, the data is also written back to storage in that format. The workflow orchestration system, such as LinkedIn\u2019s open-source workflow manager Azkaban , then triggers subsequent jobs based on the completion of preceding ones. Within a DM job (Spark application), Spark generates a series of Spark jobs, each composed of multiple stages. Each stage consists of one or more tasks, with a shuffle step occurring between stages. Figure 2. Overview of Spark-based data manipulation jobs There are some challenges when operating and tuning such a complex data pipeline: Complex dependency and workflow management. With 100+ jobs and dependencies between these jobs, it is challenging to pinpoint the true source of performance issues. A slowdown in one job can have cascading effects, making it seem like multiple jobs are slow. Conversely, improving the execution time of one job may inadvertently negatively impact downstream jobs, potentially making the whole data pipeline slower. These complexities make exhaustive individual job tuning impractical. Instead, a systematic approach to identifying bottlenecks is necessary, focusing on understanding the critical path and identifying the most impactful jobs to optimize. Constraints of compute resources. A common approach to improving Spark job performance is to increase compute resources (e.g., the number of executors). However, at LinkedIn, there are resource caps enforced for each Spark job to ensure fair resource allocation. Our DM pipeline handles massive data volumes and performs complex transformations, pushing some jobs already to these resource limits. Consequently, simply adding more resources is no longer a viable solution for performance enhancement. This indicates alternative strategies which we will discuss in the following sections. Uneven data distribution. From our observation, the DM jobs of the search system powering Sales Navigator involve frequent operations on multiple datasets, which usually causes uneven data distribution. For example, some DM jobs need to union more than 20 datasets with widely varied sizes, ranging from a few MBs to hundreds of TBs. This disparity in data volume can lead to imbalanced workloads across executors and cause performance issues in subsequent processing. Data pipeline performance tuning and optimization Pruning job graph The DM jobs can be visualized as a large dependency graph. One of the initial steps in optimization, before fine-tuning the Spark configurations for each job, is to prune this job graph. This usually involves identifying and eliminating unnecessary dependencies and consolidating related jobs. For instance, as shown in the figure below, the DM pipeline initially included three separate jobs for a product dataset: data preprocessing, data transformation, and data postprocessing. Analysis of the job dependencies revealed that no other jobs relied on the intermediate outputs of the preprocessing and transformation jobs. This presented an opportunity for significant optimization. By consolidating these three jobs into a single \"product data processing\" Spark job, we eliminated the overhead of writing intermediate data to storage and reading it back in subsequent jobs. This straightforward pruning resulted in a time saving of over 30 minutes for this part of the pipeline. Figure 3. An example of combining jobs This example highlights the importance of optimizing the job graph before focusing on individual Spark job configurations. Pruning the graph reduces the overall workload and minimizes I/O operations, leading to more efficient execution. We strongly recommend prioritizing job graph optimization as a first step in any DM pipeline performance tuning effort. Identifying bottlenecks It is impractical to meticulously tune each job. To minimize the total execution time, we focused on jobs that are on the critical path and those that act as bottlenecks. By analyzing the dependencies and execution times, we can pinpoint bottlenecks and determine the critical path\u2014the sequence of jobs that determines the overall pipeline duration. For instance, figure 4 below illustrates a subset of our data manipulation pipeline's job graph. Jobs A, B, and C run in parallel, with Job B taking the longest at 1 hour and 35 minutes. Meanwhile, Job D depends on the completion of Jobs A, B, and C, meaning it won't start until the three are finished. Therefore, optimizing Job B will directly reduce the overall pipeline duration. Job D is also a priority because any improvement in its execution time will also directly impact the overall pipeline duration. Figure 4. Visualization of jobs\u2019 execution times Spark job tuning Data repartitioning Data skewness, where data is unevenly distributed across partitions, is a common performance bottleneck in long-running Spark jobs. The index building of LinkedIn Sales Navigator search system involves unions of multiple source datasets. For such DM jobs, data skewness was a recurring issue. In Spark UI, the \"Shuffle Read\" column in the executor metrics is a key indicator for data skewness. If a small number of executors handle a disproportionately large share of the shuffle read volume, it strongly suggests data skewness. Repartitioning is a common technique to mitigate data skewness by redistributing the datasets more evenly. In Spark SQL, repartition() operates on one or more table columns, so understanding the data distribution of datasets is crucial for effective repartitioning. Choosing a column with high cardinality and a relatively uniform distribution is generally recommended. In our use case, repartitioning based on the unique search document ID reduced one DM job\u2019s execution time from around 2 hours to just 30 minutes. The table below shows a subset of executor information after repartitioning the data. Note that the shuffle read volumes are equal in the executors. Executor ID Complete Tasks Task Time Shuffle Read 498 4 23 min 4.3 GB 363 4 27 min 4.3 GB 374 4 32 min 4.3 GB 524 4 38 min 4.3 GB 303 4 30 min 4.3 GB An insufficient number of shuffle partitions can also contribute to data skewness. If this number is too low, even with a good partitioning key, data can still be unevenly distributed. A common starting point for determining the number of shuffle partitions is to use a value close to the product of the executor count and each executor\u2019s cores. However, this is just a starting point. The optimal value depends on the data size, distribution, and the specific transformations being performed. On one occasion, we set the number of shuffle partitions lower than the number of Spark executors, leading to resource wastage and extended execution times. By adjusting this value proportionally to the number of executors, we reduced the execution time of this Spark job by more than 30 minutes. Broadcast join Broadcast joins are a popular query processing optimization technique used in multiple SQL engines, such as Spark SQL and Presto / Trino . This method is particularly beneficial when joining two tables of significantly varied sizes. In a typical join (like a shuffle hash join), both tables are partitioned and shuffled across the network so that matching rows reside on the same executor. This shuffling process can be expensive, especially for large tables. Broadcast joins circumvent this by copying the entire smaller table ( build table or broadcast table ) to each executor. Each executor then performs a local join between its copy of the broadcast table and its partition of the larger table ( probe table ). Figure 5. Overview of broadcast joins The DM jobs in the search system powering Sales Navigator usually involve join operations on multiple datasets, whose sizes vary from a few MBs to hundreds of TBs. Through our tuning of large-scale DM jobs, we found that using broadcast join effectively reduced the execution time of a Spark job from over 1 hour to around 20 minutes by broadcasting a table of roughly 40 MB, slightly exceeding the default 10 MB threshold in Spark. However, broadcast joins have limitations \u2013 each executor needs to store a copy of the broadcast table in memory. If the broadcast table is too large, it can lead to OutOfMemory exceptions on the executors. Moreover, while broadcasting avoids shuffling the larger table, it still requires transferring the broadcast table to all executors. If the broadcast table is very large, this initial broadcast can become a bottleneck, saturating network bandwidth. In our experience, attempting to broadcast a table larger than 2 GB resulted in significant performance degradation due to these limitations. Therefore, it's crucial to carefully consider the size of the tables involved and the available executor resources when deciding whether to use a broadcast join. Auto-tuning LinkedIn\u2019s Spark team developed a rule-based auto-tuning tool called Right-Sizing . This system analyzes the historical runs of a Spark job over the last 30 days and adjusts Spark job parameters, such as executor memory and memory overhead, for subsequent runs. This not only automates the tuning of job configurations but also highlights potential areas for further optimization. For instance, if right-sizing frequently detects OutOfMemory issues in past runs and increases executor memory, it suggests we should closely examine memory usage to identify any opportunities for improvement. For readers who do not have access to such auto-tuning tools, we recommend collecting information from historical runs and deriving insights from that data. Leveraging .par for parallel processing Scala provides a built-in operation, .par , that converts a collection into a parallel collection. This enables processing the collection in parallel by utilizing multiple CPU cores. The final step of Sales Navigator search system\u2019s DM pipeline is a series of join operations on transformed DataFrames. For such use cases, we observed that enabling the .par operation can significantly reduce the execution time of operations involving multiple DataFrames. Considering the following code snippet where .par is applied to optimize join operations on sorted DataFrames: sortedDfs.par.reduce((df1, df2) => { df1.join(df2, Seq(column), \"full_outer\") }) Without .par , each join operation depends on the result of the previous one, which makes the entire process sequential. This sequential execution limits resource utilization and increases overall processing time. By converting sortedDfs into a parallel collection, we instruct the driver to orchestrate the joins in parallel, which will divide the parallel collection into chunks. This parallelism allowed us to reduce the execution time of a Spark-based data processing job by around 30 minutes. While .par offers performance benefits, it comes with trade-offs. The .par operation and the coordination of the parallel reduce happen on the Spark driver. Therefore, the driver's available compute resources can become a bottleneck, especially with a large number (20+) of DataFrames, due to the increased orchestration overhead. Meanwhile, the actual join operations are executed on Spark executors. Parallelizing the joins with .par increases the demand for executor resources. It is crucial to ensure sufficient executors are available to handle the concurrent workloads. Key takeaways Evolving data architectures require ongoing tuning and adjustments to previous settings. In large-scale enterprise environments, these architectures continuously adapt to growing requirements, often making previous configurations obsolete. Experimentation is usually needed to find the optimal new settings. Implement critical path analysis and identify bottlenecks before tuning each job . Enterprise-grade data pipelines usually consist of a large number of jobs, making it impractical to tune every one efficiently. Optimization should focus on jobs within the critical path and those causing bottlenecks, with a thorough job dependency graph analysis pinpointing high-impact areas for targeted tuning. Pay attention to data skewness in Spark jobs, especially those that union multiple datasets . Understanding the distribution of your data allows you to select efficient repartitioning strategies, minimizing imbalances and optimizing job performance. Broadcast joins are efficient when joining tables of different sizes . Efficiently employing broadcast joins can significantly accelerate join operations by minimizing shuffle operations. However, careful consideration of table sizes is required to balance performance gains against resource limitations. From our experience, tables less than 40 MB are potential candidates for broadcasting. Historical executions of data manipulation jobs provide valuable insights that can be leveraged to improve future performance. In Spark, for example, historical memory usage statistics can imply necessary memory requirements. By analyzing historical job performance data, auto-tuning tools can make informed adjustments to job configurations, automating and enhancing the tuning process. The .par operation converts a collection into a parallel collection , which allows leveraging multiple cores to process the collection concurrently. This simple yet efficient optimization can greatly improve the execution time. However, when handling operations on numerous (20+) datasets, it is essential to ensure adequate compute resources for both Spark driver and Spark executors. Holistic optimization is key for reducing the execution time of complex data pipelines. This involves not just isolated tweaks but a comprehensive strategy\u2014pruning job dependencies, identifying and resolving bottlenecks, and applying targeted configuration optimizations for sustainable performance improvements. Acknowledgment Optimizing and fine-tuning large-scale DM jobs is a complex project that demands collaborative effort across various teams. We extend our sincere appreciation to all contributors from the search federation team, the hosted search team, and the LinkedIn sales solution team. Our gratitude also goes to Vibhaakar Sharma , Sangeetha Rajagopalan , and Brent Miller for their strategic vision, guidance, and unwavering support. Finally, we thank Scott Banachowski for his insightful comments, which greatly enhanced the quality of this blog.",
+    "quality_score": 8,
+    "modules": [
+      "performance",
+      "integration",
+      "complexity"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/rethinking-hfds-block-placement-for-exabyte-scale-clusters",
+    "title": "Scaling maintenance: Rethinking HDFS block placement for exabyte-scale clusters",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "As a platform constantly fed by millions of data signals, LinkedIn has massive offline data processing needs. That\u2019s why we operate some of the largest Apache Hadoop clusters in the world. These clusters, which currently store ~5 exabytes of data and ~10 billion objects, are growing exponentially. There are dozens of clusters, each with several thousand datanodes, the largest housing 10,000+ datanodes and ~500 million blocks. To ensure that mission critical data processing runs seamlessly, we must guarantee 99.99% data availability across all these clusters. We do this by keeping our infrastructure up to date with software, firmware and hardware. This requires frequent deployments of new HDFS versions, OS upgrades and network switch upgrades. Given the large cluster sizes, some degree of disruption is unavoidable during upgrades, but our goal is to ensure that nodes are upgraded with the latest OS patches within 60 days. Ensuring compliance with applying the latest patches within 60 days is a critical component of LinkedIn's robust framework for maintaining the security and reliability of its infrastructure. Previously, all clusters were configured to use the default block placement policy (BPP), but, as our clusters grew, the default approach began underperforming across maintenance operations. To resolve this, we considered redistributing 3+ exabytes of data by simply toggling BPP to upgrade domain BPP and adding upgrade domains to all datanodes. However, this would impact the read/write load on our HDFS clusters, clog the network, and make a lot of jobs that process the data to/from HDFS fail. Instead, we made changes to the BPP and redistributed all 3+ exabytes of existing data to successfully unclog the network and eliminated the need for data replication during maintenance operations. This blog post dives into the challenges in performing maintenance operations across large clusters with large volumes of data and strict availability requirements. It also covers how we improved the velocity of maintenance and reduced or eliminated data replication for maintenance. We hope this blog will be informative and helpful for engineers and teams who design/maintain large scale distributed systems. Brief overview of HDFS and LinkedIn\u2019s data redundancy policy In HDFS, files are stored as fixed size blocks, the atomic units in HDFS. Each block is replicated N times for redundancy. The applications writing the data to HDFS can select the number of times it\u2019s replicated but, by default, we replicate each block three times. Figure 1 below shows the namenode's role in managing metadata, mapping files to blocks and noting which datanodes store each block for efficient file management. After obtaining the necessary information from the NameNode, HDFS clients establish direct communication with the specified datanodes to read/write files. Figure 1: HDFS - read/write path Block placement policy Block placement policy (BPP) is the strategy by which data blocks are distributed or placed across nodes in a HDFS. The default BPP in HDFS is to place replicas in a minimum of 2 different network racks. When the replication factor is set to 3, the system writes the first replica to a datanode in Rack-X. The second and third replicas are then written to two separate datanodes located in Rack-Y. This distribution helps in safeguarding the data even if one rack becomes unavailable. If the replication factor is greater than 3 (i.e., N where N > 3), the placement process is as follows: for each additional replica (where the replica index x satisfies 3 < x \u2264 N), the system selects a random datanode from any rack, ensuring that it does not choose a datanode that has already been selected for previous replicas. Figure 2 is a representation of default BPP with 6 datanodes spread across 3 racks. The dots inside the datanodes indicate blocks and the same color dots represent the replica of the same block. We can see 3 replicas of a single block in 3 different datanodes but in 2 racks. Any of the racks going down will ensure that at least 1 replica is available. Figure 2: HDFS - Default block placement policy Challenges of cluster maintenance operations When we perform various maintenance operations like OS upgrades and switch upgrades throughout the year, we need to restart the server or datanode process each time. While doing so, we need to ensure there is no data loss and complete the maintenance operations soon enough to be compliant with the OS upgrade target of 60 days. HDFS provides two different approaches to perform planned maintenance on the datanodes (as seen in figure 3 below). Approach1 - Decommissioning the datanodes All the blocks in the datanode are replicated to other nodes before the node is considered ready for maintenance. Right after the decommissioning is triggered, the state of the datanode moves to Decommission-in-progress and once all the blocks are replicated elsewhere, the state changes to Decommissioned. The maintenance operation starts after this state change. However, this usually takes ~4 hours for 1% of datanodes to be decommissioned. Approach 2 - Using maintenance mode This method ensures that a minimum number of live replicas for each block in the datanode is in some other live datanode before it can be taken down. Let\u2019s say M is the Minimum Live Replicas, M can be configured at a cluster level and we use M=2 in our clusters. namenode ensures this criterion is met by replicating data to additional datanodes, before a datanode can be considered as ready for maintenance. Right after the datanodes are put in maintenance mode, the state of the datanode moves to Entering Maintenance. Once a minimum live replicas number of replicas are replicated elsewhere, the state changes to In Maintenance. The maintenance operation starts after this state. This option takes ~30 minutes for the data to be replicated before the nodes can be taken down for maintenance. Figure 3: Datanode states while doing maintenance operations Since Default BPP requires a significant number of blocks to be replicated, both the above approaches were inadequate since they put pressure on the namenode resources and the network usage. The time taken for the replication and the network traffic was directly proportional to the number of datanodes in a batch that is chosen for maintenance. This made it difficult to make OS upgrades and switch upgrades at the pace we wanted, increasing the risk of missing compliance and thus compromising security. Streamlining maintenance velocity with upgrade domain We needed to increase the pace of maintenance operations with the least impact on the network. This meant changing the data redundancy to an entity that is much larger than a rack. Upgrade domains in HDFS is a logical tag to each datanode. Data replication can use upgrade domains as part of upgrade domain block placement policy. Figure 4 shows upgrade domain BPP with 6 datanodes spread across 3 racks. The dots inside the datanodes indicate blocks. Dots of the same color represent the replica of the same block. We can see 3 replicas of a single block in 3 different datanodes and in 3 different racks. Any of the racks going down will ensure that 2 replicas are available. This helps with maintenance mode not having to replicate blocks since there are 2 minimum live replica blocks available. Figure 4: HDFS - upgrade domain block placement policy We ultimately decided to use the upgrade domains and switch to upgrade domain BPP since it eliminates the need to replicate data for maintenance. This included the following steps: Define 20 upgrade domains so that in each cluster. All nodes in a rack are given the same upgrade domain. This is needed to ensure that not more than 1 replica of a block is in a rack. Upgrade domains are assigned in a way that the datanodes are as evenly distributed as possible across the upgrade domains. Add the upgrade domain to each data node in the namenode config. Configure HDFS to use CombinedHostFileManager to understand the upgrade domains Configure namenode to use the upgrade domain BPP. Change the systems that perform maintenance operations (OS upgrade, switch upgrade, Deployments) to batch datanodes by upgrade domains. Upgrade domain count was chosen to be 20 because LinkedIn decided to have 20 maintenance zones for all the Data systems. The above steps ensure all the new data is replicated to different upgrade domains. But our HDFS clusters had 3+ exabytes of data already and we needed to figure out a way to redistribute them according to the upgrade domain BPP. Redistributing 3+ exabytes of data without impacting organic traffic Our initial approach was to add upgrade domain to all datanodes and toggle the BPP to upgrade domain BPP. But that approach would have caused millions of blocks to be moved across data nodes to adhere to upgrade domain BPP, and would have impacted the read/write operations on our HDFS clusters. The upgrade domain BPP expects the upgrade domain for each datanode to be provided as part of the namenode configuration. When a datanode doesn\u2019t have an explicit upgrade domain, its xfer-address (IP+port) is taken as the default upgrade domain. We leveraged this to add upgrade domains only to a partial set of datanodes at a time and to redistribute data in those datanodes so that they adhere to upgrade domains. The remaining nodes were considered to have unique upgrade domains since their xfer-address was considered as the upgrade domain. Putting the selected datanodes to maintenance mode after adding their upgrade domain, could help ensure that all the blocks in those datanodes adhered to the upgrade domain BPP. The OS upgrades were running almost ubiquitously in all the production clusters every day since this was mandatory to keep up the compliance. We didn\u2019t want the existing data redistribution run in addition to OS upgrades because, It would increase the total under replicated blocks It would increase the time taken for the datanodes to enter IN_MAINTENANCE state since there are too many under replicated blocks Hence it was better to perform the redistribution of data according to the upgrade domain BPP by piggy-backing to the OS upgrade process when it is running. We just had to add upgrade domain for the selected datanodes as part of the OS upgrades orchestrator, as depicted in figure 5. Figure 5: Piggy backing onto OS upgrades In figure 5, the services color coded as centralized services are the services that do OS upgrades across all stacks at LinkedIn. The services color coded as grid services are the ones that handle cluster management for Hadoop eco-system at LinkedIn. Here is a brief description of the components: Grid inventory is an inventory system for all the static metadata and dynamic state of all HDFS and Yarn compute nodes across all the Hadoop clusters. upgrade domains were added as additional metadata. Insync is a centralized service at LinkedIn that provides distributed lock as a service for a given scope. For this use case, we acquire locks at Cluster+NameNode level. This is to ensure that no other process simultaneously performs another maintenance operation or deployment. Note: the actual OS upgrades process and bringing the services up afterwards are beyond the scope of this article. If you are interested in OS upgrades at LinkedIn, see this article . For various reasons, the OS upgrades are paused at times. We built a simple orchestrator to redistribute the data during those times which is depicted in figure 6. Figure 6: Redistribute existing data and add upgrade domains Performance considerations After the upgrade domain was added to most of the datanodes, we started to notice performance degradation in HDFS writes. On analysis, we found that the upgrade domain BPP from Hadoop open source was inefficient in selecting the target datanode for Nth replica where 1 < N < upgrade_domain_factor, when all datanodes in a rack are part of the same upgrade domain. Upgrade_domain_factor is the minimum number of upgrade domains the replicas should be distributed across. We had set it to 3. The inefficiency is because upgrade domain BPP assumes that nodes in a single rack can have multiple upgrade domains. Because of this assumption, target node selection to place the third replica tries to evaluate all the nodes in the rack of the second replica as a possible target. All of them fail the BPP criteria evaluation since all nodes in the rack will have the same upgrade domain. This leads to 40+ target evaluation failures before the namenode can get N valid targets for each block write call. Hence the degradation in performance. The target evaluation failures just cause it to evaluate another node - hence it works functionally albeit rather slowly. The upgrade domain BPP\u2019s assumption of multiple upgrade domains in a rack did not work for our use case, since it would need blocks to be replicated out before we can perform ToR switch upgrades for the racks - where we have to take down all the nodes in the rack for maintenance. This is because we configured the clusters to have at least 2 live replicas for each block with maintenance mode. Hence we created a new BPP to exclude all the nodes of already selected upgrade domains as part of target selection until upgrade_domain_factor replicas. Figure 7 shows the improved write latencies after the change. Figure 7: Improved write latency with new BPP Conclusion With the changes to the BPP and redistribution of all 3+ exabytes of existing data, we are able to upgrade the OS/ToR switches for ~4.5% of datanodes per cluster per day. It has also eliminated the data replication while doing maintenance operations which has unclogged the network. A modified version of this BPP is also used to migrate clusters across data centers. These enhancements have significantly improved the reliability, security, and high availability of HDFS, ensuring seamless support for critical member-facing and enterprise applications. Acknowledgments Thanks to Aditya Raj Verma for being part of data migration strategy and analysis. Thanks to Hariharan S , Arjun Mohnot , Sandeep Venugopalan , Colin Pereira and Ravikiran R for integrating Upgrade domains to all parts of the Hadoop ecosystem. Special thanks to Amit Balode for his leadership, Chris Trezzo and Srikanth Sundarrajan for their guidance, Gopal Venkatesan , Anuj Maurice and Nirav Kalyani for their help in reviewing this article.",
+    "quality_score": 9,
+    "modules": [
+      "architecture_patterns",
+      "error_resilience",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/securing-every-kubernetes-workload-at-scale",
+    "title": "Securing every Kubernetes workload at scale",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "LinkedIn's commitment to keep our systems and user data safe at massive scale starts by establishing a chain of trust, starting with the physical hardware and extending to software workloads. The focus of the Modern PKI at LinkedIn: Anchored in hardware and designed for scale addresses the foundational components of node identity, particularly leveraging Trusted Platform Module (TPM) hardware integrated with the SPIRE framework to solidify node identity management. Once the hardware is secured, we focus on Workload Identity , which covers every piece of software running at LinkedIn. These workloads are diverse, ranging from the services that power LinkedIn\u2019s feed to complex Machine Learning (ML) pipelines and massive data processing jobs. To ensure that only authorized software can communicate with our production systems, we assign every Kubernetes workload a digital credential that acts as a signed ID card. This credential\u2019s identity is attested against an internal Identity Registry to prevent \"identity spoofing\"\u2014a tactic where a malicious program tries to pretend it is a legitimate one. This entire process is baked into the lifecycle of the software, so a workload is identified and secured the moment it is created. In this blog, we are excited to share how we built our next-generation security framework to protect Kubernetes workload at massive scale. We\u2019ll explore how we scaled cert-manager , and extended it with an Identity Registry to provide automated credential lifecycle management with stronger identity attestation, ensuring trust across multiple Kubernetes clusters. Why cert-manager? As LinkedIn\u2019s Infrastructure grows, so does the diversity of workloads we need to support. It requires a flexible system to secure diverse types of workloads \u2013 from Flink streams to Airflow and Flyte jobs, online applications plus multiple storage solutions including third-party systems like Couchbase, MySQL and manually deployed workloads. To support this workload diversity, we addressed how our technical frameworks\u2014both client and server\u2014consume certificates from the filesystem. cert-manager\u2019s CSI driver gave us a Kubernetes-native way to inject certificates directly as workload container volumes as files, meeting this requirement seamlessly. Additionally, the CSI driver secures the private key by ensuring it never leaves the node, keeping it in memory to mitigate exfiltration risks. Finally, we had to solve for the unique complexity of our multi-cluster architecture. A job orchestrated in one Kubernetes cluster can spawn worker pods in a different cluster. This meant our workload identity system had to go beyond single-cluster boundaries, with consistent attestation and issuance across clusters. This introduces fundamental challenges: How to manage the lifecycle of workload certificates securely and at LinkedIn\u2019s scale. The need to standardize certificate issuance to serve a diverse set of workloads. The need for a flexible plugin based system that can serve these diverse requirements. At LinkedIn, we leverage cert-manager to address these requirements. cert-manager is a modular, extensible platform that provides: Automated certificate management including issuance, rotation and deletion. Seamless integration with the internal Identity Registry for strong workload attestation Adaptability to a wide range of use cases with custom issuers and approver policies. cert-manager Integration with LinkedIn Kubernetes To scale the certificate management, we offer two modes tailored to the needs of different workloads: Fully Managed : This is the default and most widely used solution. Adoption is as simple as adding a label to Kubernetes deployment. cert-manager solution manages certificates issuance, renewal, secure storage, secure access, and deletion of certificates i.e. it aims to manage the complete lifecycle of certificates tied directly to the deployment lifecycle. Self Serve : For workloads outside the deployment system\u2014such as manually deployed services or third-party platforms like Couchbase \u2014 we offer a self-serve model for teams to manage their certificates and its lifecycle. cert-manager platform provides approval-policies and teams request certificates by creating cert-manager custom resources like Certificate or CertificateRequest . Below is a high-level diagram, different components and steps involved to support a fully managed solution. Figure 1: cert-manager Integration with LinkedIn Kubernetes Components: To support the fully managed solution we integrate open source cert-manager components i.e cert-manager controller, webhook, approver-policy, and cert-manger csi-driver daemonset with below internal components: Identity Registry: A Centralized Identity Registry Service to guarantee the Global Unique Identity (UID) to each workload. It provides identity proofing, attestation policies, audit and identity governance controls. HSM Service: A secure proxy to Hardware Security Module (HSM) devices. It exposes APIs to trusted certificate issuers to fetch cluster specific signing CA keys. Trusted issuers fetch and store the signing key in its memory. Mutating Admission Webhook: A mutating admission webhook which acts on Kubernetes pods with a specific label. If a label is present, it reads the pod spec, validates container images and mutates the pod spec to inject cert-manager csi volume and appropriate volume attributes. This volume is mounted to the application container as a readonly. Lipki-Controller: Our custom cert-manager controller. A CertificateRequest Approver and Issuer. It defines a CRD LiClusterIssuer to manage Signing CA and most importantly Reconciles CertificateRequest. It validates the CertificateRequest generated by the cert-manager CSI Driver, performs workload identity attestation using the Identity Registry, signs and issues the Certificate. High-Level Workflow: This automated workflow seamlessly issues a unique digital identity to every workload at the moment of creation. This ensures that all software is strongly verified and securely managed throughout its lifecycle, guaranteeing a reliable and secure infrastructure. The deployment system deploys a workload with creation of custom resources (like LiDeployment , LiStatefulSet ), These systems add the ` spiffe: enabled ` label to request the cert-manager spiffe certificate. The cert-manager mutating webhook intercepts pods with above label: Adds a Container Storage Interface (CSI) volume for ` csi.cert-manager.io ` driver. Mounts the volume into the application container. Sets cert-manager CSI volume attributes with applications metadata like application-name, product-name, issuer-group, issuer-kind, issuer-name, etc. As pod gets scheduled on the node, kubelet invokes the cert-manager CSI driver daemonset pod during the NodePublishVolume Publish event. cert-manager CSI driver creates a CertificateRequest (CR) with Pod Info as OwnerRef, the lipki-controller issuer reference and adds custom LinkedIn specific application metadata in the CR annotations based on 2(c). Lipki-controller reconciles CertificateRequests: Validates the CR\u2019s issuer reference and its status, determines its owner pod, fetches the pod spec from its cache, Performs the workload attestation with Identity Registry and gets unique identity based on application metadata, If attestation is successful, approves CR, signs the certificate and adds application specific DNS SANs. The signed certificate is mounted into the pod by cert-manager CSI driver\u2013 securely and transparently. Kyverno Policy Integration: Integrating with Kyverno policies adds a vital layer of security guardrails to ensure only pre-approved, PKI-managed sources can issue certificates, strict access controls that only authorized systems can request identities, keeping the entire Kubernetes cluster consistent and secure. We integrated with LinkedIn Kyverno\u2019s deployment with two policies: Restrict Issuers: We restrict all CertificateRequests to use only PKI team-managed Issuer/ClusterIssuer resources, preventing misuse or shadow issuance. This policy ensured that CertificateRequests for a specific domain used a designated ClusterIssuer. Restrict CertificateRequest Creators: CertificateRequest creation is RBAC-controlled. Only certain service accounts are authorized to create requests. For user-initiated flows, we provide clear guidelines on how to request and approve certificates using Certificate resources. cert-manager Adoption Strategy Our core objective was to seamlessly migrate from our legacy certificate system to newer cert-manager, while ensuring: Automated Trust: We ensured every workload automatically received strongly attested identity certificates. This enables mTLS (mutual TLS), meaning every interaction between services is encrypted and both sides must prove their identity before data is exchanged. Zero-Friction Security: Our goal was to eliminate \u201cdeveloper toil,\u201d by making secure configurations the automatic default and making unsafe options difficult to implement, developers can focus on building features while the infrastructure handles the security. Seamless Transition: To maintain platform stability, we built full backward compatibility. This allowed new cert-manager-issued certificates to live alongside legacy ones, ensuring that migration didn\u2019t break and providing a safe config based switch to roll-back changes instantly if needed. Real-Time Observability: Managing thousands of applications requires clear data. We built dashboards to provide precise visibility into the migration, allowing us to track adoption progress and proactively identify any services that hadn't yet moved to the modern standard. Gradual Rollout To ensure a smooth rollout, we started with an opt-in model. Applications could begin using SPIFFE-based certificates issued by cert-manager simply by adding a label to Kubernetes pod: \u2018 spiffe: enabled\u2019. This label signaled the deployment system and cert-manager integration to issue SPIFFE certificate to the workload, all in a fully managed way. Reducing Developer Toil with Library Integrations To simplify adoption, we invested in removing technical hurdles for our developers. We built and maintained authentication libraries for Java, Go, and Rust that handle the complexities of building the secure client credential, finding paths to certificates and truststore. These libraries allow services to set up secure mTLS connections, ensuring both the sender and receiver are verified. To keep this process airtight, certificates and keys are mounted into a secure, restricted path within the application\u2019s container, protected by file access controls. By integrating these libraries directly into LinkedIn\u2019s standard service frameworks, we made secure defaults the norm across Java, Python, Go, and Rust. The libraries automatically manage details like trust-bundles, encryption cipher suites, and TLS versions. For certain application frameworks like java-grpc, java-jetty, we even provided advanced TLS features like \"hot-reloadable\" SSL contexts, which allow software to pick up renewed certificates instantly without needing an application restart. This strategy allowed teams to adopt our new security standards incrementally while boosting performance and operational resilience across the entire platform. Below is the high-level diagram describing the inter-service communication between two applications via mTLS and leveraging the lifecycle managed certificates via cert-manager. Figure 2: Workload Identity Usage & Certificate Lifecycle Management The application containers leverage the authentication libraries provided by PKI team, which provides the secure client credential, used by server and client frameworks for HTTPS or gRPC requests. The CSI Driver Daemonset Pod manages the certificate lifecycle and renews these certificates on application container volume before they expire. Certain server and client frameworks like java-grpc have advanced TLS features to hot reload the SSL Contexts which starts using newer certificates for mTLS for newer requests. If no advanced features are enabled then applications require a restart to reload the newer certificates. Improving Security at Scale Challenges Integrating cert-manager at LinkedIn\u2019s scale revealed that cert-manager controller and approver-policy controller with default configurations hit the scale issues, when faced with burst creation of CertificateRequest (CR) concurrently. Our primary challenge was managing the \u201cdeployment churn\u201d: since our systems allow up to 20% of all workload pods to restart simultaneously in a cluster. cert-manager Scale Requirements: Nodes per Kubernetes Cluster: 5,000 and can grow as infrastructure supports it. Pods per Node: It can support up to 110 pods per node (with default settings), although this can be configured based on the workload and environment. In LinkedIn use cases, we supported 50 workload pods per node. Total Pods per Cluster: with 5,000 nodes and 50 pods per node ie 50*5000 = 250,000 pods per cluster. We have Kubernetes deployment operators which manage the lifecycle of pods. Certain Pod Specification changes by deployment operators led to deletion and re-creation of all their managed pods within the configurable Pod Disruption Budget (PDB). It is configured to be 20%, which implies 20% of all its managed pods in a given Kubernetes cluster can be deleted and re-created. Each pod is associated with one or more CertificateRequests. This implies 20% of 250,000 = 50,000 pods implying requirement to support 50K and more concurrent CertificateRequests (CR). cert-manager SLO: Our aim is to support the above scale of 50K concurrent CertificateRequest generation, approval and issuance with P95 of 60secs. In our initial approach, we relied on the open source approver-policy controller as the CertificateRequest approver for both fully managed and self-serve use cases. However, in performance tests we realized approver-policy could not support our SLO requirements when 8K CertificateRequests are created concurrently. We also realized that the approver-policy controller reviews incoming CertificateRequest with all Approver Evaluators with every CertificateRequestPolicy ( ref ). Moreover, In our implementation the majority of CertificateRequests are created by the CSI Driver daemonset service account. Figure 3: Approver-Policy CertificateRequest Approval - Performance Test Due to our scale requirements and variance in approver logic for the \u201cFully Managed\u201d Solution, we diverted from cert-manager approver controller and built a custom internal approver controller to serve the CertficateRequest Approval. To add, this custom approver relies on Identity Registry to fetch workload identity along with the CertificateRequests owner pod specification metadata to decide on the approval or denial of a CertificateRequest. We still rely on the Approver-Policy Controller for the \u201cSelf-Serve\u201d use-case for the Certificate or CertificateRequest Approval. Lipki-Controller To meet our SLO requirements, we decided to implement the custom approval controller \u2018lipki-controller\u2019 in Figure 1, as part of the external issuer that is specific to the fully managed solution. This custom controller reconciles CertificateRequest, watches Pod Resources with SPIFFE label enabled. To solve the scale challenges we performed following functionalities: Performance Tuning: Initial stress tests highlighted the need for tuning the Kubernetes API QPS (Queries Per Second), burst rates, and concurrent worker configurations within the controller to handle high-volume CRs. We configured the lipki-controller with these configurations. KubernetesAPIQPS: 1000 KubernetesAPIBurst: 2000 MaxConcurrent CertificateRequests Reconciliation: 20 Resources: requests: cpu: 2, memory: 8Gi limits: cpu: 4, memory: 20Gi Observability and Monitoring: Integrated monitoring dashboards and alert systems to track certificate request metrics in real-time, thereby ensuring operational readiness and quick incident response. Certain metrics that we monitor are: Controller Workqueue Depth, Workqueue Duration, CertificateRequests Reconciliation Time, Error Count, Error Rate, CertificateRequest Approve Latency, and controller runtime metrics like CPU usage, Memory Usage, and Goroutine counts. Horizontal Scaling: Further needs were identified for horizontally scaling the lipki-controller for disaster recovery, which is crucial for maintaining high availability and meeting the SLOs. We performed a scale test up to 54K CertificateRequests creation, its approval and issuance by the lipki-controller. We were able to scale the approval and issuance of a CertificateRequest with P90 of 19.3 seconds with the CPU utilization of 45%. Figure 4: lipki-controller - Performance Tests Lipki-Controller Disaster Recovery The current lipki-controller can vertical scale up-to certain CPU & Memory limits, however vertical scale has inherent limitations that restrict the overall scalability and performance for the Certificate Issuance system. Therefore to mitigate limitations, we combine vertical and horizontal scaling to meet our SLO requirements. To horizontally scale the lipki-controller, we added the ability to shard the CertificateRequests. The sharding is achieved by setting the custom annotation on the CertificateRequest, the change: cert-manager/csi-driver#212 added the capability to add custom annotations to the CertificateRequest. The CSI-Driver v0.8.0+ has this capability ( reference ). The mutating admission webhook, adds the cert-manager csi-volume attribute to specify the lipki-controller partition. In this example, volume in a pod and the pod\u2019s certificate request as generated by csi-driver: # The example Pod Spec: Cert-Manager CSI Volument Attributes: \u2717 kubectl describe pod my-app-c5n4h -n cert-manager .... Volumes: spiffe: Type: CSI (a Container Storage Interface (CSI) volume source) Driver: csi.cert-manager.io FSType: ReadOnly: true VolumeAttributes: csi.cert-manager.io/issuer-group=identity.linkedin.com csi.cert-manager.io/issuer-kind=LiClusterIssuer csi.cert-manager.io/issuer-name=lipki-controller lipkiissuer.cert-manager.io/partition=default # The CertificateRequest with custom annotation of default partition \u2717 kubectl describe cr 284a3c45-4dd0-41a5-9eae-49becb819804 -n cert-manager Name: 284a3c45-4dd0-41a5-9eae-49becb819804 Namespace: cert-manager Labels: csi.cert-manager.io/node-id-hash=779d9b8dcd csi.cert-manager.io/volume-id-hash=588ff8bb45 Annotations: lipkiissuer.identity.linkedin.com/partition: default API Version: cert-manager.io/v1 Kind: CertificateRequest ... We added the capability in the lipki-controller\u2019s certificate request controller to only reconcile CertificateRequest with a particular partition annotation value. The partition value can be passed a controller command line argument and while setting up the manager, as shown in the below example code reference: func (r *CertificateRequestReconciler) SetupWithManager(mgr ctrl.Manager, partitionValue string) error { partitionAnnotationKey := identity.LiIssuerKey + identity.DefaultPartitionKey return ctrl.NewControllerManagedBy(mgr). For(&cmapi.CertificateRequest{}, builder.WithPredicates( predicate.NewPredicateFuncs(func(object client.Object) bool { cr := object.(*cmapi.CertificateRequest) // Ignore CertificateRequests that are already approved or denied. if cmutil.CertificateRequestIsApproved(cr) || cmutil.CertificateRequestIsDenied(cr) { return false } // Checks for the partition value value, annotationExists := cr.ObjectMeta.Annotations[partitionAnnotationKey] if annotationExists && partitionValue == value { return true } return false }), )). Complete(r) } As a note: This horizontal scale solution does not require a scaler controller that can dynamically create or delete new controllers based on the load; this solution as of now targets only disaster recovery in a cluster. Conclusion In our journey to secure every Kubernetes workload at scale at LinkedIn, we have demonstrated the transformative potential of adopting innovative and scalable solutions like cert-manager to address the ever-evolving challenges of managing workload identity. By leveraging cert-manager, we've successfully automated the lifecycle of workload certificates, strengthened workload identity security through strong identity attestation, and optimized the way we manage certificates for a diverse range of workloads across a multi-cluster environment. Moving forward, our focus will remain on further enhancing the system's scalability, observability, and ease of adoption. By advancing our PKI ecosystem and ensuring robust workload identity management, we aim to continue setting industry benchmarks in securing cloud-native architectures at an unparalleled scale. This initiative not only strengthens LinkedIn\u2019s infrastructure but also serves as a testament to the transformative power of open-source technologies when adapted to solve critical, enterprise-scale challenges. We hope our insights and learnings inspire the broader community to explore approaches to secure, automated solutions in their own environments. Acknowledgements We would like to extend our gratitude to everyone who contributed to securing Kubernetes workloads, this would not have been possible without the efforts of our team members: Sindhu Ravichandran , Sandesh Patnurkar , Yogesh Patil , Wei Zhang , Di Jin and the entire LinkedIn PKI team. We are particularly grateful to Omkhar Arasaratnam , Rohit Pitke , and Di Jin , for dedicating their time and providing invaluable reviews and thoughtful feedback on this blog post, ensuring its clarity and technical excellence. Our heartfelt thanks also go to LinkedIn alumni: Sindhu Ravichandran , Alex Tcherniakovski , Priya Ayyagari , and Sergei Rousakov , whose contributions played a significant role in this initiative. Finally, we extend our sincere gratitude to our engineering leaders, Omkhar Arasaratnam and Lea Kissner , for their steadfast support and guidance throughout this journey. Their leadership and vision have been instrumental to the success of this effort.",
+    "quality_score": 9,
+    "modules": [
+      "security",
+      "architecture_patterns",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://quarkus.io/blog/new-benchmarks/",
+    "title": "Quarkus has great performance \u2013 and we have new evidence",
+    "source_name": "Quarkus Blog",
+    "text": "tl;dr Performance is important to Quarkus, but our published performance graphics were outdated and missing important information (such the fact that we have fantastic throughput). To fix that, we built a new benchmark that is transparent, reproducible, and measures the full performance picture. In our experiments, Quarkus can handle 2.7 times more transactions per second than Spring Boot, as well as starting 2.3 times faster, all in half the memory. The start of the story If you\u2019ve ever visited the quarkus.io site (and of course you have, because you\u2019re here), you\u2019ll probably have spotted the performance charts near the bottom of the front page. The Quarkus team are proud of our performance, because good performance means high scalability, low latency, low resource usage, lower costs, and better sustainability. Basically, performance matters. This is what we used to show: But despite the importance of performance, our performance charts had a few problems. Firstly, the numbers are out of date. How out of date? Well, it\u2019s hard to say, because there\u2019s no date on the chart. In fact, there\u2019s no information at all about how the numbers were measured, and no link to the benchmark source code. This means no one can reproduce it, which means no one can validate. If it\u2019s not reproducible, it\u2019s not trustworthy. Why didn\u2019t we just link to the benchmark source code? Historically, we\u2019ve been deliberately vague about what we were comparing against (manners!). Sharing the source code would have made it totally obvious what the other framework was. As well as preventing us from the sharing of the benchmark source, anonymizing the other framework had its own problems. Not sharing the framework name is polite, but it means we\u2019re not giving readers useful information to make an informed choice of framework. Is Quarkus better? Oh yes, definitely. Better than what? Shhh, that\u2019s a secret. But there\u2019s an even bigger problem with our old graphics, in my view. We show Quarkus starts fast, and we show it has a small footprint. We do not show anything about throughput. There\u2019s a classic performance tradeoff between throughput and memory footprint or startup time. It\u2019s easy for people looking at the charts to assume that if Quarkus doesn\u2019t show its throughput figures, they must be terrible, right? Wrong! For Quarkus, there is no trade-off . Quarkus is more efficient than alternatives across the board. (Want to know where trade-off strikes back? Read on .) But this misconception that Quarkus must have bad throughput turns up all over the place. It keeps popping up in external blogs, and if you ask your favourite AI service about the advantages of Quarkus, it\u2019s unlikely to mention throughput. Instead, it will focus on startup time or memory. Those are important, but so is throughput. There\u2019s another, more subtle, omission in our charts that also contributes to misunderstanding about Quarkus. We show the performance of Quarkus in native mode, but we don\u2019t show the performance of the other framework in native mode. Some people take this to mean that Quarkus is all about native mode, and if they\u2019re using Quarkus, they should be using native mode. We often see blogs which compare Quarkus in native mode to other frameworks in JVM mode, which is just silly. Quarkus in JVM mode should be compared to other frameworks in JVM mode, and Quarkus in native mode should be compared to other frameworks in native mode. Quarkus happens to be very good at native mode, but whether you want to use native mode is an orthogonal choice to what framework you choose. Because of all these problems, several members of the Quarkus community have ended up their own benchmarks to use in conference talks, or for demos. I\u2019ve done it myself, in fact. Having members of the same team re-doing similar work is wasteful. What\u2019s more, benchmarking is hard! Getting numbers is trivially easy, but getting numbers which are actually measuring what you think you\u2019re measuring is hard. Doing it really really right needs the sorts of skills performance specialists have. Ok, so we definitely needed a new benchmark Something had to be done. Luckily, my colleague Eric Deandrea had been working on this exact problem for several years. Eric had a benchmark, based on an earlier one from John O\u2019Hara, and he\u2019d built up a set of automations which allowed measurements to be run in our performance lab, under controlled conditions. Eric and I set up a new repository , moved Eric\u2019s benchmark code into there, and refined the automations to push results out past the lab\u2019s firewall to another repository , acting as a data store. We got numbers, and (after a bit of work with Apache Batik ), pictures! Notice how great Quarkus\u2019s throughput is. Quarkus can handle 2.7 times (19255 vs 7238 tps) more transactions per second than Spring Boot, as well as starting 2.3 times (2.919s vs 6.569s) faster, all in half the memory (269 MB instead of 583 MB). This was when the real work began. With the benchmark now open sourced, it was open to scrutiny in a way it hadn\u2019t been before. (This, of course, is part of the magic of open source.) Francesco Nigro, one of our Quarkus performance experts, spotted some areas where measurements could be made more robust. For example, our setup used cgroups with cpuset to pin processes to specific CPU cores \u2014 which is the right approach \u2014 but both the application under test and the load generator ended up in the same cgroup, competing for those same cores. With the load generator configured to use 16 threads, this introduced significant noise in the measurements. Switching to separate core assignments fixed that, though other sources of interference remained, such as the database not having its own dedicated cores and a cache-drop step that was inadvertently affecting every process on the host. Once proper isolation was in place, the throughput results shifted \u2014 and in a subtle way. Before the fix, slower frameworks appeared competitive because their lower load left more breathing room for the other processes. They were being flattered by the very contention they were causing less of. The chart above reflects the improved setup. This is what I meant earlier about benchmarking requiring skill \u2014 these mistakes are easy to make and subtle to detect. But the best help came from outside the Quarkus community. Our intention with the benchmark was to replicate the experience of a normal user, not to tune each framework to within an inch of its life. (There\u2019s TechEmpower for that.) Measuring the \"out of the box\" performance seemed like the best route, partly because the sort of performance most people will experience by default, and also because it was most fair. Fairness was a strong goal, because otherwise, what\u2019s the point in comparing? Our team have the skills to tune Quarkus applications to razor-sharp performance, but most of us don\u2019t have those same skills for Spring. It\u2019s just not in our job description. Tuning Quarkus but not Spring would clearly not be fair. But after we\u2019d started publishing the first set of results, we were approached by people who used Spring Boot every day. They pointed out that there were differences in how the two frameworks handled open-session-in-view settings, and connection pool sizes. These differences were significant enough that we started to evaluate whether comparing the out-of-the-box behaviour actually was the fairest option. It turns out that open-session-in-view settings and fixing the N+1 problem didn\u2019t make much difference to the numbers, but adjusting connection pool sizes did. In its default configuration, the Spring application was suffering from serious connection errors. If the client can\u2019t connect, there\u2019s no throughput, so the errors were lowering throughput. Eric, Francesco, and Sanne Grinovero spent a lot of time digging into the logs and profiling to work out configuration tweaks to ensure the Spring application could handle the load without errors. Our Spring friends told us that these sorts of adjustments would be completely standard. We still wanted to measure out of the box performance, so we settled on a compromise. We measured both out of the box, and a lightly tuned version. In the graphics we show on the front page, we\u2019re showing the tuned version. Here\u2019s the tuned equivalent of the out of the box results above, for the same code level and scripts: You can see that the effect of the tuning was pretty modest, overall. Notice, as well, that there was a bit of a trade-off between throughput and memory footprint; for both frameworks, the tuning optimisations ended up sacrificing some memory to improve speed. Guiding principles In trying to decide how to handle the question of tuning, we ended up referring back to the guiding principles for the whole exercise. They were: Parity The application code in the Spring and Quarkus versions of the application should be as equivalent as possible to perform the same function. This means the domain models should be identical, and the underlying persistence mechanisms should be identical (in our case, JPA with Hibernate). Performance differences should come from architecture differences and library-integration optimisations in the frameworks themselves. If a change is made that changes the architecture of an application (i.e. moving blocking to reactive, using virtual threads, etc), then these changes should be applied to all the versions of the applications. Normal-ness Realism is more important than squeezing out every last bit of performance. High quality Applications should model best practices. Although we want the application to represent a typical usage, someone who copies it shouldn\u2019t ever be copying 'wrong' or bad code. Testing the framework, not the infrastructure Measurements should be measuring the performance of the frameworks, rather than supporting infrastructure like the database. In practice this means we want the experimental setup to be CPU-bound. Exploring our performance One of the nice things about this work is that it\u2019s allowed us to explore various performance-related questions, beyond just \"does Quarkus have awesome performance?\" For example, would running with virtual threads affect the results? Yes! Virtual threads added about 6k transactions per second, for all frameworks. And we had more questions, too. Was there a performance difference between Spring Boot 3 and Spring Boot 4? It turns out things got better in some ways, and worse in others. Spring 4 gives higher throughput than Spring 3, but at the expense of a slower time to first response, and a higher memory footprint. What would Quarkus' new AOT packaging do for startup times? (We\u2019re still working on that one, but I\u2019m excited to see the answer.) The throughput vs startup tradeoff, revisited I mentioned that with Quarkus, there was no trade-off between startup time and performance. When compared to other frameworks, this is definitely true. The internal efficiencies of Quarkus, like the build-time principle, improve both startup time and throughput. But if you compare Quarkus on JVM against Quarkus native, the trade-off is back! When using GraalVM to compile Quarkus applications to native, Quarkus starts faster than a lightbulb, and has a pretty small memory footprint. But there is a throughput penalty. Going native cuts throughput in half. (For Spring Boot, the native penalty is similar.) For most applications, this trade-off isn\u2019t worth it, especially when combined with the longer build times and extra constraints of native. But sometimes, the trade-off is worth it: if your application gets started and stopped super-often or has very low workloads, use native. Want to try the benchmarks at home? You can! All of the source code and scripts are available at https://github.com/quarkusio/spring-quarkus-perf-comparison . Easy reproducibility for everyone was an important guiding principle when we designed the benchmark, but it does get kind of complicated. In the performance world, \"rigorous\" and \"easy\" do not go in the same sentence. As someone who always wants to make hard things accessible, this really frustrates me. In the end, we\u2019ve ended up with a compromise. If you happen to have a performance lab handy, this is of course ideal. All of the scripts are available for you to run the jobs on your own hardware. If you don\u2019t have that kind of setup, but do have a Linux machine, you can still use the expert-approved scripts we use. Under the covers, they use tools like qDup for orchestration and Hyperfoil to drive load without risking coordinated omission, and ensure process isolation. But what if you want something really easy? At this point, things get harder. We created a second version of the scripts which are optimised for simplicity. They use only familiar tools, and don\u2019t attempt process isolation. Because of this, they can be run on both Mac and Linux, and, with the right terminal, Windows. The results need to be treated with caution; laptop power management can cause all sorts of wild effects, and if the load is too much or too little, you might end up measuring a bottleneck which has nothing to do with Quarkus or Spring. We\u2019re planning another blog (or six!) on how to avoid the most common problems, and how to tell if you\u2019re measuring what you think you are.",
+    "quality_score": 8,
+    "modules": [
+      "java_patterns",
+      "performance",
+      "complexity"
+    ]
   }
 ]

```

### Commit 3: 54ce9be
**Message:** feat: expand seed corpus with observability batch

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index 9420e56..369aace 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -111,3 +111,9 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 110,track2,react_patterns,"js_advanced,performance",https://react.dev/blog/2025/10/01/react-19-2,"React 19.2","React Blog","The React Team",2025-10-01,9,"A high-signal React release post covering Activity, useEffectEvent, cacheSignal, performance tracks, and partial pre-rendering, which makes it excellent seed material for modern React architecture.",kept,,
 111,track2,react_patterns,"dependency_health,security",https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components,"Critical Security Vulnerability in React Server Components","React Blog","The React Team",2025-12-03,8,"A practical framework-security article that goes beyond a CVE notice by mapping affected packages, frameworks, and exact upgrade paths teams need to execute quickly.",kept,,
 112,track2,dependency_health,"security,devops",https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/,"Our plan for a more secure npm supply chain","The GitHub Blog","Xavier Rene-Corail",2025-09-22,8,"A solid dependency-health article on npm hardening, trusted publishing, and ecosystem-level guardrails that directly affect how teams manage package risk in CI/CD.",kept,,
+113,track2,observability,"js_advanced,dx",https://blog.cloudflare.com/introducing-workers-observability-logs-metrics-and-queries-all-in-one-place/,"Introducing Workers Observability: logs, metrics, and queries – all in one place","Cloudflare Blog","Rohin Lohe",2025-04-09,8,"A practical observability article that also shows how structured logs, query builders, and runtime metadata reshape the JavaScript developer experience on Workers.",kept,,
+114,track2,observability,"design_patterns,devops",https://blog.cloudflare.com/building-cloudflare-on-cloudflare/,"Building Cloudflare on Cloudflare","Cloudflare Blog","Ariel Rosenthal; Vlad Lesin",2023-03-07,8,"A strong systems article on how Cloudflare composes logs, metrics, traces, service bindings, and internal Workers into an opinionated observability architecture.",kept,,
+115,track2,js_advanced,"design_patterns,performance",https://blog.cloudflare.com/a-better-web-streams-api/,"We deserve a better streams API for JavaScript","Cloudflare Blog","James M Snell",2026-02-27,9,"A high-signal JavaScript API-design piece that critiques Web Streams from first principles and proposes a more ergonomic, higher-performance alternative rooted in iterables.",kept,,
+116,track2,js_advanced,"api_design,clean_code",https://blog.cloudflare.com/improving-web-standards-urlpattern/,"New URLPattern API brings improved pattern matching to Node.js and Cloudflare Workers","Cloudflare Blog","Yagiz Nizipli; James M Snell; Daniel Lemire",2025-03-24,8,"A useful standards-and-runtime article that explains why URLPattern improves route matching ergonomics, spec compliance, and shared implementation quality across JavaScript runtimes.",kept,,
+117,track2,design_patterns,"devops,integration",https://github.blog/engineering/engineering-principles/github-enterprise-cloud-with-data-residency/,"GitHub Enterprise Cloud with data residency: How we built the next evolution of GitHub Enterprise using GitHub","The GitHub Blog","Jim Wang",2024-09-23,8,"A good architecture case study on extending an existing SaaS platform with regional isolation while preserving unified pipelines, feature sync, and deploy-then-merge discipline.",kept,,
+118,track2,observability,"design_patterns,security",https://engineering.fb.com/2025/01/22/security/how-meta-discovers-data-flows-via-lineage-at-scale/,"How Meta discovers data flows via lineage at scale","Engineering at Meta","Rishab Mangla; David Taieb; Wenlong Dong; Gabriela Jacques da Silva; Brani Stojkovic; Slobodan Predolac; Alex Lambert; Francesco Logozzo; Taha Bekir Eren",2025-01-22,8,"A strong large-scale observability and architecture article on combining static analysis, runtime probes, and graph tooling to make data flows explorable across massive systems.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index 1e16f20..3d41179 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -1341,5 +1341,77 @@
       "security",
       "devops"
     ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/introducing-workers-observability-logs-metrics-and-queries-all-in-one-place/",
+    "title": "Introducing Workers Observability: logs, metrics, and queries – all in one place",
+    "source_name": "Cloudflare Blog",
+    "text": "2025-04-09 4 min read We’re excited to announce Workers Observability – a new section in the Cloudflare Dashboard that allows you to query detailed log events across all Workers in your account to extract deeper insights. In 2024, we set out to build the best first-party observability for any cloud platform. Since then, we’ve improved metrics reporting for all resources, launched Workers Logs to automatically ingest and store logs for Workers, and rebuilt real-time logs with improved filtering. However, observability insights have been limited to a single Worker. Starting today, you can use Workers Observability to understand what is happening across all of your Workers: Workers Metrics Dashboard (Beta) : A single dashboard to view metrics and logs from all of your Workers Query Builder (Beta) : Construct structured queries to explore your logs, extract metrics from logs, create graphical and tabular visualizations, and save queries for faster future investigations. Workers Logs: Now Generally Available, with a public API and improved invocation-based grouping. Building queries The Query Builder allows you to interact with your logs, and answer the “why” to any question you have. You can find it by navigating to Workers & Pages > Observability in the dashboard. Using the Query Builder, you can now answer more questions than ever. For example, this query shows the p90 wall time for 200 OK responses from the /reference endpoint is 6 milliseconds. The key components to structuring a query in the Query Builder are: Visualizations : An aggregate function like average, count, percentile, or unique that performs a calculation on a group of values to return a single value. Each aggregate function returns a graph visualization and a summary table. Filters : A condition that allows you to exclude data not matching the criteria. Search : A condition that only returns the data matching the specified string. Group by : A function to collapse a field into only its distinct values, allowing you to more granularly apply aggregate functions. Order by : A sorting function to order the returned rows. Limits : A cap on the number of returned rows, allowing you to focus on what is important. The Query Builder relies on structured logs for efficient indexed queries and extracting metrics from logs. Workers Observability natively supports and encourages structured logs. Structured logs store context-rich metadata as key-value pairs in the form of distinct fields ( high dimensionality ), each with many potential unique values ( high cardinality ). Invocation Logs , which can be enabled in your Worker, contain deep insights from Cloudflare’s network, and are a great example of a structured log. By logging important metadata as a structured log, you empower yourself to answer questions about your system that you couldn’t predict when writing the code. Internally at Cloudflare, we’ve already found tremendous value from this new product. During development, the Workers Observability team was able to use the Query Builder to discover a bug in the Workers Observability team’s staging environment. A query on the number of the events per script returned the following response: After mapping this drop in recorded events against recent staging deployments, the team was able to isolate and root cause the introduction of the bug. Along with fixing the bug, the team also introduced new staging alerts to prevent errors like this from going unnoticed. Queries built with the Query Builder or Workers Logs can be saved with a custom name and description. You can star your favorite queries, and also share them with your teammates using a shareable link, making it easier than ever to debug together and invest in developing visualizations from your telemetry data. CPU time and wall time You can now monitor CPU time and wall time for every Workers invocation across all of our observability offerings, including Tail Workers , Workers Logpush , and Workers Logs . These metrics help show how much time is spent executing code compared to the total elapsed time for the invocation, including I/O time. For example, using the CPU time and wall time surfaced in the Invocation Log , you can use the Query Builder to show the p90 CPU time and wall time traffic for a single Worker script. Revamped Workers metrics In February, we released a new view into your Workers’ metrics to help you monitor your gradual deployments with improved visualizations. Today, we are also launching a new Workers Metrics overview page in the Observability tab . Now you can easily compare metrics across Workers and understand the current state of your deployments, all from a single view. Invocations view Invocations are mechanisms to trigger the execution of a Worker or Durable Object in response to an event, such as an alarm, cron job, or a fetch. When the Worker or Durable Object executes, log events are emitted. To date, we have surfaced logs in an events view where each log is ordered by the time it was published. We’re now introducing an Invocations View, so you can group and view all logs from each invocation. These views are available in each Worker’s view and the Workers Observability tab . Workers Observability API You can now use the Workers Observability API to programmatically retrieve your telemetry data and populate the tool of your choice. The API allows you to automate, integrate, and customize in ways that our dashboard may not. For example, you may want to analyze your logs in a notebook or correlate your Workers logs with logs from a different source. Leveraging the Workers Observability API can help you optimize your monitoring strategy, automate repetitive tasks, and improve flexibility in how you interact with your telemetry data. Enable Workers Logs today To use Workers Logs , enable it in your Workers’ settings in the dashboard or add the following configuration to your Workers’ wrangler file: # wrangler.jsonc { \"observability\": { \"enabled\": true, \"logs\": { \"invocation_logs\": true, \"head_sampling_rate\": 1 } } } We’re just getting started. We have lots in store to help make Cloudflare’s developer observability best-in-class. Join us in Discord in the #workers-observability channel for feedback and feature requests. Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Developer Week Developers General Availability Cloudflare Workers Workers Logs Workers Observability",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "js_advanced",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/building-cloudflare-on-cloudflare/",
+    "title": "Building Cloudflare on Cloudflare",
+    "source_name": "Cloudflare Blog",
+    "text": "2023-05-18 16 min read Cloudflare’s website, application security and performance products handle upwards of 46 million HTTP requests per second, every second. These products were originally built as a set of native Linux services, but we’re increasingly building parts of the system using our Cloudflare Workers developer platform to make these products faster, more robust, and easier to develop. This blog post digs into how and why we’re doing this. System architecture Our architecture can best be thought of as a chain of proxies, each communicating over HTTP. At first, these proxies were all implemented based on NGINX and Lua , but in recent years many of them have been replaced - often by new services built in Rust, such as Pingora . The proxies each have distinct purposes - some obvious, some less so. One which we’ll be discussing in more detail is the FL service, which performs “Front Line” processing of requests, applying customer configuration to decide how to handle and route the request. This architecture has worked well for more than a decade. It allows parts of the system to be developed and deployed independently, parts of the system to be scaled independently, and traffic to be routed to different nodes in our systems according to load, or to ensure efficient cache utilization. So, why change it? At the level of latency we care about, service boundaries aren’t cheap, particularly when communicating over HTTP. Each step in the chain adds latency due to communication overheads, so we can’t add more services as we develop new products. And we have a lot of products, with many more on the way. To avoid this overhead, we put most of the logic for many different products into FL. We’ve developed a simple modular architecture in this service, allowing teams to make and deploy changes with some level of isolation. This has become a very complex service which takes a constant effort by a team of skilled engineers to maintain and operate. Even with this effort, the developer experience for Cloudflare engineers has often been much harder than we would like. We need to be able to start working on implementing any change quickly, but even getting a version of the system running in a local development environment is hard, requiring installation of custom tooling and Linux kernels. The structure of the code limits the ease of making changes. While some changes are easy to make, other things run into surprising limits due to the underlying platform. For example, it is not possible to perform I/O in many parts of the code which handle HTTP response processing, leading to complex workarounds to preload resources in case they are needed. Deploying updates to the software is high risk, so is done slowly and with care. Massive improvements have been made in the past years to our processes here, but it’s not uncommon to have to wait a week to see changes reach production, and changes tend to be deployed in large batches, making it hard to isolate the effect of each change in a release. Finally, the code has a modular structure, but once in production there is limited isolation and sandboxing, so tracing potential side effects is hard, and debugging often requires knowledge of the whole system, which takes years of experience to obtain. Developer platform to the rescue As soon as Cloudflare workers became part of our stack in 2017, we started looking at ways to use them to improve our ability to build new products. Now, in 2023, many of our products are built in part using workers and the wider developer platform; for example, read this post from the Waiting Room team about how they use Workers and Durable Objects, or this post about our cache purge system doing the same. Products like Cloudflare Zero Trust , R2 , KV , Turnstile , Queues , and Exposed credentials check are built using Workers at large scale, handling every request processed by the products. We also use Workers for many of our pieces of internal tooling, from dashboards to building chatbots. While we can and do spend time improving the tooling and architecture of all our systems, the developer platform is focussed all the time on making developers productive, and being as easy to use as possible. Many of the other posts this week on this blog talk about our work here. On the developer platform, any customer can get something running in minutes, and build and deploy full complex systems within days. We have been working to give developers working on internal Cloudflare products the same benefits. Customer workers vs internal workers At this point, we need to talk about two different types of worker. The first type is created when a customer writes a Cloudflare Worker. The code is deployed to our network, and will run whenever a request to the customer’s site matches the worker’s route. Many Cloudflare engineering teams use workers just like this to build parts of our product - for example, we wrote about our Coreless Purge system for Cache recently. In these cases, our engineering teams are using exactly the same process and tooling as any Cloudflare customer would use. However, we also have another type of worker, which can only be deployed by Cloudflare. These are not associated with a single customer. Instead, they are run for all customers for which a particular product or other piece of logic needs to be performed. For the rest of this post, we’re only going to be talking about these internal workers. The underlying tech is the same - the difference to remember is that these workers run in response to requests from many Cloudflare customers rather than one. Initial integration of internal workers We first integrated internal workers into our architecture in 2019, in a very simple way. An ordered chain of internal workers was created, which run before any customer scripts. I previously said that adding more steps in our chain would cause excessive latency. So why isn’t this a problem for internal workers? The answer is that these internal workers run within the same service as each other, and as customer workers which are operating on the request. So, there’s no need to marshal the request into HTTP to pass it on to the next step in the chain; the runtime just needs to pass a memory reference around, and perform a lightweight shift of control. There is still a cost of adding more steps - but the cost per step is much lower. The integration gave us several benefits immediately. We were able to take advantage of the strong sandbox model for workers, removing any risk of unexpected side effects between customers or requests. It also allowed isolated deployments - teams could deploy their updates on their own schedule, without waiting for or disrupting other teams. However, it also had a number of limitations. Internal workers could only run in one place in the lifetime of a request. This meant they couldn’t affect services running before them, such as the Cloudflare WAF. Also, for security reasons, internal workers were published with an internal API using special credentials, rather than the public workers API. In 2019, this was no big deal, but since then there has been a ton of work to improve tooling such as wrangler , and build the developer platform. All of this tooling was unavailable for internal workers. We had very limited observability of internal workers, lacking metrics and detailed logs, making them hard to debug. Despite these limitations, the benefits of being able to use the workers ecosystem were big enough that ten products used these internal workers to implement parts of their logic. These included Zaraz , our Cloudflare challenges system , Waiting Room and several of our performance optimization products: Image Resizing , Images , Mirage and Rocket Loader . Such workers are also a core part of Automatic Platform Optimization for WordPress . Can we replace internal services with workers? We realized that we could do a lot more with the platform to improve our development processes. We also wondered how far it would be possible to go with the platform. Would it be possible to migrate all the logic implemented in the NGINX-based FL service to the developer platform? And if not, why not? So we started, in late 2021, with a prototype. This routed traffic directly from our TLS ingress service to our workers runtime, skipping the FL service. We named this prototype Flame. It worked. Just about. Most importantly for a prototype, we could see that we were missing some fundamental capabilities. We couldn’t access other Cloudflare internal services, such as our DNS infrastructure or our customer configuration database, and we couldn’t emit request logs to our data pipeline, for analytics and billing purposes. We rely heavily on caching for performance, and there was no way to cache state between requests. We also couldn’t emit HTTP requests directly to customer origins, or to our cache, without using our full existing chain-of-proxies pipeline. Also, the developer experience for this prototype was very poor. We couldn’t take advantage of all the developer experience work being put into wrangler, due to the need to use special APIs to deploy internal workers. We couldn’t record metrics and traces to our standard observability tooling systems , so we were blind to the behavior of the system in production. And we had no way to perform a controlled and gradual deployment of updated code. Improving the developer platform for internal services We set out to address these problems one by one. Wherever possible, we wanted to use the same tooling for internal purposes as we provide to customers. This not only reduces the amount of tooling we need to support, but also means that we understand the problems our customers face better, and can improve their experience as well as ours. Tooling and routing We started with the basics - how can we deploy code for internal services to the developer platform. I mentioned earlier that we used special internal APIs for deploying our internal workers, for “security reasons”. We reviewed this with our security team, and found that we had good protections on our API to identify who was publishing a worker. The main thing we needed to add was a secure registry of accounts which were allowed to use privileged resources. Initially we did this by hard-coding a set of permissions into our API service - later this was replaced by a more flexible permissions control plane. Even more importantly, there is a strong distinction between publishing a worker and deploying a worker. Publishing is the process of pushing the worker to our configuration store, so that the code to be run can be loaded when it is needed. Internally, each worker version which is published creates a new artifact in our store. The Workers runtime uses a capability-based security model . When it is published, each script is bundled together with a list of bindings, representing the capabilities that the script has to access other resources. This mechanism is a key part of providing safety - in order to be able to access resources, the script must have been published by an account with the permissions to provide the capabilities. The secure management of bindings to internal resources is a key part of our ability to use the developer platform for internal systems. Deploying is the process of hooking up the worker to be triggered when a request comes in. For a customer worker, deployment means attaching the worker to a route. For our internal workers, deployment means updating a global configuration store with the details of the specific artifact to run. After some work, we were finally able to use wrangler to build and publish internal services. But there was a problem! In order to deploy an internal worker, we needed to know the identifier for the artifact which was published. Fortunately, this was a simple change : we updated wrangler to output debug information which contained this information. A big benefit of using wrangler is that we could make tools like “wrangler test” and “wrangler dev” work. An engineer can check out the code, and get going developing their feature with well-supported tooling, and within a realistic environment. Event logging We run a comprehensive data pipeline, providing streams of data for our customers to allow them to see what is happening on their sites, for our operations teams to understand how our system is behaving in production, and for us to provide services like DoS protection and accurate billing. This pipeline starts from our network as messages in Cap’n Proto format. So we needed to build a new way to push pieces of log data to our internal pipeline, from inside a worker. The pipeline starts with a service called “logfwdr”, so we added a new binding which allowed us to push an arbitrary log message to the logfwdr service. This work was later a foundation of the Workers Analytics Engine bindings, which allow customers to use the same structured logging capabilities. Observability Observability is the ability to see how code is behaving. If you don’t have good observability tooling, you spend most of your time guessing. It’s inefficient and frankly unsafe to operate such a system. At Cloudflare, we have very many systems for observability, but three of the most important are: Unstructured logs (“syslogs”). These are ingested to systems such as Kibana, which allow searching and visualizing the logs. Metrics. Also emitted from all our systems, these are a set of numbers representing things like “CPU usage” or “requests handled”, and are ingested to a massive Prometheus system . These are used for understanding the overall behavior of our systems, and for alerting us when unexpected or undesirable changes happen. Traces. We use systems based around Open Telemetry to record detailed traces of the interactions of the components of our system. This lets us understand which information is being passed between each service, and the time being spent in each service. Initial support for syslogs, metrics and traces for internal workers was built by our observability team, who provided a set of endpoints to which workers could push information. We wrapped this in a simple library, called “flame-common”, so that emitting observability events could be done without needing to think about the mechanics behind it. Our initial wrapper looked something like this: import { ObservabilityContext } from \"flame-common\"; export default { async fetch( request: Request, env: Env, ctx: ExecutionContext ): Promise<Response> { const obs = new ObservabilityContext(request, env, ctx); // Logging to syslog and kibana obs.logInfo(\"some information\") obs.logError(\"an error occurred\") // Metrics to Prometheus obs.counter(\"rps\", \"how many requests per second my service is doing\")?.inc(); // Tracing obs.startSpan(\"my code\"); obs.addAttribute(\"key\", 42); }, }; An awkward part of this API was the need to pass the “ObservabilityContext” around to be able to emit events. Resolving this was one of the reasons that we recently added support for AsyncLocalStorage to the Workers runtime. While our current observability system works, the internal implementation isn’t as efficient as we would like. So, we’re also working on adding native support for emitting events, metrics and traces from the Workers runtime. As we did with the Workers Analytics Engine, we want to find a way to do this which can be hooked up to our internal systems, but which can also be used by customers to add better observability to their workers. Accessing internal resources One of our most important internal services is our configuration store, Quicksilver . To be able to move more logic into the developer platform, we need to be able to access this configuration store from inside internal workers. We also need to be able to access a number of other internal services - such as our DNS system, and our DoS protection systems. Our systems use Cap’n Proto in many places as a serialization and communication mechanism, so it was natural to add support for Cap’n Proto RPC to our Workers runtime. The systems which we need to talk to are mostly implemented in Go or Rust, which have good client support for this protocol. We therefore added support for making connections to internal services over Cap’n Proto RPC to our Workers runtime. Each service will listen for connections from the runtime, and publish a schema to be used to communicate with it. The Workers runtime manages the conversion of data from JavaScript to Cap’n Proto, according to a schema which is bundled together with the worker at publication time. This makes the code for talking to an internal service, in this case our DNS service being used to identify the account owning a particular hostname, as simple as: let ownershipInterface = env.RRDNS.getCapability(); let query = { request: { queryName: url.hostname, connectViaAddr: control_header.connect_via_addr, }, }; let response = await ownershipInterface.lookupOwnership(query); Caching Computers run on cache, and our services are no exception. Looking at the previous example, if we have 10,000 requests coming in quick succession for the same hostname, we don’t want to look up the hostname in our DNS system for each one. We want to cache the lookups. At first sight, this is incompatible with the design of workers, where we give no guarantees of state being preserved between requests. However, we have added a new internal binding to provide a “volatile in-memory cache”. Wherever it is possible to efficiently share this cache between workers, we will do so. The following flowchart describes the semantics of this cache. To use the cache, we simply need to wrap a block of code in a call to the cache: const owner = await env.OWNERSHIPCACHE.read<OwnershipData>( key, async (key) => { let ownershipInterface = env.RRDNS.getCapability(); let query = { request: { queryName: url.hostname, connectViaAddr: control_header.connect_via_addr, }, }; let response = await ownershipInterface.lookupOwnership(query); const value = response.response; const expiration = new Date(Date.now() + 30_000); return { value, expiration }; } ); This cache drastically reduces the number of calls needed to fetch external resources. We are likely to improve it further, by adding support for refreshing in the background to reduce P99 latency, and improving observability of its usage and hit rates. Direct egress from workers If you looked at the architecture diagrams above closely, you might have noticed that the next step after the Workers runtime is always FL. Historically, the runtime only communicated with the FL service - allowing some product logic which was implemented in FL to be performed after workers had processed the requests. However, in many cases this added unnecessary overhead; no logic actually needs to be performed in this step. So, we’ve added the ability for our internal workers to control how egress of requests works. In some cases, egress will go directly to our cache systems. In others, it will go directly to the Internet. Gradual deployment As mentioned before, one of the critical requirements is that we can deploy changes to our code in a gradual and controlled manner. In the rare event that something goes wrong, we need to make sure that it is detected as soon as possible, rather than triggering an issue across our entire network. Teams using internal workers have built a number of different systems to address this issue, but they are all somewhat hard to use, with manual steps involving copying identifiers around, and triggering advancement at the right times. Manual effort like this is inefficient - we want developers to be thinking at a higher level of abstraction, not worrying about copying and pasting version numbers between systems. We’ve therefore built a new deployment system for internal workers, based around a few principles: Control deployments through git. A deployment to an internal-only environment would be triggered by a merge to a staging branch (with appropriate reviews). A deployment to production would be triggered by a merge to a production branch. Progressive deployment. A deployment starts with the lowest impact system (ideally, a pre-production system which mirrors production, but has no customer impact if it breaks). It then progresses through multiple stages, each one with a greater level of impact, until the release is completed. Health-mediated advancement. Between each stage, a set of end-to-end tests is performed, metrics are reviewed, and a minimum time must elapse. If any of these fail, the deployment is paused, or reverted; and this happens automatically, without waiting for a human to respond. This system allows developers to focus on the behavior of their system, rather than the mechanics of a deployment. There are still plenty of plans for further improvement to many of these systems - but they’re running now in production for many of our internal workers. Moving from prototype to production Our initial prototype has done its job: it’s shown us what capabilities we needed to add to our developer platform to be able to build more of our internal systems on it. We’ve added a large set of capabilities for internal service development to the developer platform, and are using them in production today for relatively small components of the system. We also know that if we were about to build our application security and performance products from scratch today, we could build them on the platform. But there’s a world of difference between having a platform that is capable of running our internal systems, and migrating existing systems over to it. We’re at a very early stage of migration; we have real traffic running on the new platform, and expect to migrate more pieces of logic, and some full production sites, to run without depending on the FL service within the next few months. We’re also still working out what the right module structure for our system is. As discussed, the platform allows us to split our logic into many separate workers, which communicate efficiently, internally. We need to work out what the right level of subdivision is to match our development processes, to keep our code understandable and maintainable, while maintaining efficiency and throughput. What’s next? We have a lot more exploration and work to do. Anyone who has worked on a large legacy system knows that it is easy to believe that rewriting the system from scratch would allow you to fix all its problems. And anyone who has actually done this knows that such a project is doomed to be many times harder than you expect - and risks recreating all the problems that the old architecture fixed long ago. Any rewrite or migration we perform will need to give us a strong benefit, in terms of improved developer experience, reliability and performance. And it has to be possible to migrate without slowing down the pace at which we develop new products, even for a moment. We’ve done this before Rewriting systems to take advantage of new technologies is something we do a lot at Cloudflare, and we’re good at it. The Quicksilver system has been fundamentally rebuilt several times - migrating from Kyoto Tycoon , and then migrating the datastore from LMDB to RocksDB . And we’ve rebuilt the code that handles HTML rewriting , to take advantage of the safety and performance of new technologies. In fact, this isn’t even the first time we’ve rewritten our entire technical architecture for this very system. The first version of our performance and security proxy was implemented in PHP. This was retired in 2013 after an effort to rebuild the system from scratch. One interesting aspect of that rewrite is that it was done without stopping. The new system was so much easier to build that the developers working on it were able to catch up with the changes being made in the old system. Once the new system was mostly ready, it started handling requests; and if it found it wasn’t able to handle a request, it fell back to the old system. Eventually, enough logic was implemented that the old system could be turned off, leading to: Author: Dane Knecht Date: Thu Sep 19 19:31:15 2013 -0700 remove PHP. It’s harder this time Our systems are a lot more complicated than they were in 2013. The approach we’re taking is one of gradual change. We will not rebuild our systems as a new, standalone reimplementation. Instead, we will identify separable parts of our systems, where we can have a concrete benefit in the immediate future, and migrate these to new architectures. We’ll then learn from these experiences, feed them back into improving our platform and tooling, and identify further areas to work on. Modularity of our code is of key importance; we are designing a system that we expect to be modified by many teams. To control this complexity, we need to introduce strong boundaries between code modules, allowing reasoning about the system to be done at a local level, rather than needing global knowledge. Part of the answer may lie in producing multiple different systems for different use cases. Part of the strength of the developer platform is that we don’t have to publish a single version of our software - we can have as many as we need, running concurrently on the platform. The Internet is a wild place, and we see every odd technical behavior you can imagine. There are standards and RFCs which we do our best to follow - but what happens in practice is often undocumented. Whenever we change any edge case behavior of our system, which is sometimes unavoidable with a migration to a new architecture, we risk breaking an assumption that someone has made. This doesn’t mean we can never make such changes - but we do need to be deliberate about it and understand the impact, so that we can minimize disruption. To help with this, another essential piece of the puzzle is our testing infrastructure. We have many tests that run on our software and network, but we’re building new capabilities to test every edge-case behavior of our system, in production, before and after each change. This will let us experiment with a great deal more confidence, and decide when we migrate pieces of our system to new architectures whether to be “bug-for-bug” compatible, and if not, whether we need to warn anyone about the change. Again - this isn’t the first time we’ve done such a migration: for example, when we rebuilt our DNS pipeline to make it three times faster , we built similar tooling to allow us to see if the new system behaved in any way differently from the earlier system. The one thing I’m sure of is that some of the things we learn will surprise us and make us change direction. We’ll use this to improve the capabilities and ease of use of the developer platform. In addition, the scale at which we’re running these systems will help to find any previously hidden bottlenecks and scaling issues in the platform. I look forward to talking about our progress, all the improvements we’ve made, and all the surprise lessons we’ve learnt, in future blog posts. I want to know more We’ve covered a lot here. But maybe you want to know more, or you want to know how to get access to some of the features we’ve talked about here for your own projects. If you’re interested in hearing more about this project, or in letting us know about capabilities you want to add to the developer platform, get in touch on Discord . Watch on Cloudflare TV Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Developer Week Developers Deep Dive",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "design_patterns",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/a-better-web-streams-api/",
+    "title": "We deserve a better streams API for JavaScript",
+    "source_name": "Cloudflare Blog",
+    "text": "2026-02-27 24 min read This post is also available in 日本語 and 한국어 . Handling data in streams is fundamental to how we build applications. To make streaming work everywhere, the WHATWG Streams Standard (informally known as \"Web streams\") was designed to establish a common API to work across browsers and servers. It shipped in browsers, was adopted by Cloudflare Workers, Node.js, Deno, and Bun, and became the foundation for APIs like fetch() . It's a significant undertaking, and the people who designed it were solving hard problems with the constraints and tools they had at the time. But after years of building on Web streams – implementing them in both Node.js and Cloudflare Workers, debugging production issues for customers and runtimes, and helping developers work through far too many common pitfalls – I've come to believe that the standard API has fundamental usability and performance issues that cannot be fixed easily with incremental improvements alone. The problems aren't bugs; they're consequences of design decisions that may have made sense a decade ago, but don't align with how JavaScript developers write code today. This post explores some of the fundamental issues I see with Web streams and presents an alternative approach built around JavaScript language primitives that demonstrate something better is possible. In benchmarks, this alternative can run anywhere between 2x to 120x faster than Web streams in every runtime I've tested it on (including Cloudflare Workers, Node.js, Deno, Bun, and every major browser). The improvements are not due to clever optimizations, but fundamentally different design choices that more effectively leverage modern JavaScript language features. I'm not here to disparage the work that came before; I'm here to start a conversation about what can potentially come next. Where we're coming from The Streams Standard was developed between 2014 and 2016 with an ambitious goal to provide \"APIs for creating, composing, and consuming streams of data that map efficiently to low-level I/O primitives.\" Before Web streams, the web platform had no standard way to work with streaming data. Node.js already had its own streaming API at the time that was ported to also work in browsers, but WHATWG chose not to use it as a starting point given that it is chartered to only consider the needs of Web browsers. Server-side runtimes only adopted Web streams later, after Cloudflare Workers and Deno each emerged with first-class Web streams support and cross-runtime compatibility became a priority. The design of Web streams predates async iteration in JavaScript. The for await...of syntax didn't land until ES2018 , two years after the Streams Standard was initially finalized. This timing meant the API couldn't initially leverage what would eventually become the idiomatic way to consume asynchronous sequences in JavaScript. Instead, the spec introduced its own reader/writer acquisition model, and that decision rippled through every aspect of the API. Excessive ceremony for common operations The most common task with streams is reading them to completion. Here's what that looks like with Web streams: // First, we acquire a reader that gives an exclusive lock // on the stream... const reader = stream.getReader(); const chunks = []; try { // Second, we repeatedly call read and await on the returned // promise to either yield a chunk of data or indicate we're // done. while (true) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); } } finally { // Finally, we release the lock on the stream reader.releaseLock(); } You might assume this pattern is inherent to streaming. It isn't. The reader acquisition, the lock management, and the { value, done } protocol are all just design choices, not requirements. They are artifacts of how and when the Web streams spec was written. Async iteration exists precisely to handle sequences that arrive over time, but async iteration did not yet exist when the streams specification was written. The complexity here is pure API overhead, not fundamental necessity. Consider the alternative approach now that Web streams do support for await...of : const chunks = []; for await (const chunk of stream) { chunks.push(chunk); } This is better in that there is far less boilerplate, but it doesn't solve everything. Async iteration was retrofitted onto an API that wasn't designed for it, and it shows. Features like BYOB (bring your own buffer) reads aren't accessible through iteration. The underlying complexity of readers, locks, and controllers are still there, just hidden. When something does go wrong, or when additional features of the API are needed, developers find themselves back in the weeds of the original API, trying to understand why their stream is \"locked\" or why releaseLock() didn't do what they expected or hunting down bottlenecks in code they don't control. The locking problem Web streams use a locking model to prevent multiple consumers from interleaving reads. When you call getReader() , the stream becomes locked. While locked, nothing else can read from the stream directly, pipe it, or even cancel it – only the code that is actually holding the reader can. This sounds reasonable until you see how easily it goes wrong: async function peekFirstChunk(stream) { const reader = stream.getReader(); const { value } = await reader.read(); // Oops — forgot to call reader.releaseLock() // And the reader is no longer available when we return return value; } const first = await peekFirstChunk(stream); // TypeError: Cannot obtain lock — stream is permanently locked for await (const chunk of stream) { /* never runs */ } Forgetting releaseLock() permanently breaks the stream. The locked property tells you that a stream is locked, but not why, by whom, or whether the lock is even still usable. Piping internally acquires locks, making streams unusable during pipe operations in ways that aren't obvious. The semantics around releasing locks with pending reads were also unclear for years. If you called read() but didn't await it, then called releaseLock(), what happened? The spec was recently clarified to cancel pending reads on lock release – but implementations varied, and code that relied on the previous unspecified behavior can break. That said, it's important to recognize that locking in itself is not bad. It does, in fact, serve an important purpose to ensure that applications properly and orderly consume or produce data. The key challenge is with the original manual implementation of it using APIs like getReader() and releaseLock() . With the arrival of automatic lock and reader management with async iterables, dealing with locks from the users point of view became a lot easier. For implementers, the locking model adds a fair amount of non-trivial internal bookkeeping. Every operation must check lock state, readers must be tracked, and the interplay between locks, cancellation, and error states creates a matrix of edge cases that must all be handled correctly. BYOB: complexity without payoff BYOB (bring your own buffer) reads were designed to let developers reuse memory buffers when reading from streams, an important optimization intended for high-throughput scenarios. The idea is sound: instead of allocating new buffers for each chunk, you provide your own buffer and the stream fills it. In practice, (and yes, there are always exceptions to be found) BYOB is rarely used to any measurable benefit. The API is substantially more complex than default reads, requiring a separate reader type ( ReadableStreamBYOBReader ) and other specialized classes (e.g. ReadableStreamBYOBRequest ), careful buffer lifecycle management, and understanding of ArrayBuffer detachment semantics. When you pass a buffer to a BYOB read, the buffer becomes detached – transferred to the stream – and you get back a different view over potentially different memory. This transfer-based model is error-prone and confusing: const reader = stream.getReader({ mode: 'byob' }); const buffer = new ArrayBuffer(1024); let view = new Uint8Array(buffer); const result = await reader.read(view); // 'view' should now be detached and unusable // (it isn't always in every impl) // result.value is a NEW view, possibly over different memory view = result.value; // Must reassign BYOB also can't be used with async iteration or TransformStreams, so developers who want zero-copy reads are forced back into the manual reader loop. For implementers, BYOB adds significant complexity. The stream must track pending BYOB requests, handle partial fills, manage buffer detachment correctly, and coordinate between the BYOB reader and the underlying source. The Web Platform Tests for readable byte streams include dedicated test files just for BYOB edge cases: detached buffers, bad views, response-after-enqueue ordering, and more. BYOB ends up being complex for both users and implementers, yet sees little adoption in practice. Most developers stick with default reads and accept the allocation overhead. Most userland implementations of custom ReadableStream instances do not typically bother with all the ceremony required to correctly implement both default and BYOB read support in a single stream – and for good reason. It's difficult to get right and most of the time consuming code is typically going to fallback on the default read path. The example below shows what a \"correct\" implementation would need to do. It's big, complex, and error prone, and not a level of complexity that the typical developer really wants to have to deal with: new ReadableStream({ type: 'bytes', async pull(controller: ReadableByteStreamController) { if (offset >= totalBytes) { controller.close(); return; } // Check for BYOB request FIRST const byobRequest = controller.byobRequest; if (byobRequest) { // === BYOB PATH === // Consumer provided a buffer - we MUST fill it (or part of it) const view = byobRequest.view!; const bytesAvailable = totalBytes - offset; const bytesToWrite = Math.min(view.byteLength, bytesAvailable); // Create a view into the consumer's buffer and fill it // not critical but safer when bytesToWrite != view.byteLength const dest = new Uint8Array( view.buffer, view.byteOffset, bytesToWrite ); // Fill with sequential bytes (our \"data source\") // Can be any thing here that writes into the view for (let i = 0; i < bytesToWrite; i++) { dest[i] = (offset + i) & 0xFF; } offset += bytesToWrite; // Signal how many bytes we wrote byobRequest.respond(bytesToWrite); } else { // === DEFAULT READER PATH === // No BYOB request - allocate and enqueue a chunk const bytesAvailable = totalBytes - offset; const chunkSize = Math.min(1024, bytesAvailable); const chunk = new Uint8Array(chunkSize); for (let i = 0; i < chunkSize; i++) { chunk[i] = (offset + i) & 0xFF; } offset += chunkSize; controller.enqueue(chunk); } }, cancel(reason) { console.log('Stream canceled:', reason); } }); When a host runtime provides a byte-oriented ReadableStream from the runtime itself, for instance, as the body of a fetch Response , it is often far easier for the runtime itself to provide an optimized implementation of BYOB reads, but those still need to be capable of handling both default and BYOB reading patterns and that requirement brings with it a fair amount of complexity. Backpressure: good in theory, broken in practice Backpressure – the ability for a slow consumer to signal a fast producer to slow down – is a first-class concept in Web streams. In theory. In practice, the model has some serious flaws. The primary signal is desiredSize on the controller. It can be positive (wants data), zero (at capacity), negative (over capacity), or null (closed). Producers are supposed to check this value and stop enqueueing when it's not positive. But there's nothing enforcing this: controller.enqueue() always succeeds, even when desiredSize is deeply negative. new ReadableStream({ start(controller) { // Nothing stops you from doing this while (true) { controller.enqueue(generateData()); // desiredSize: -999999 } } }); Stream implementations can and do ignore backpressure; and some spec-defined features explicitly break backpressure. tee() , for instance, creates two branches from a single stream. If one branch reads faster than the other, data accumulates in an internal buffer with no limit. A fast consumer can cause unbounded memory growth while the slow consumer catches up, and there's no way to configure this or opt out beyond canceling the slower branch. Web streams do provide clear mechanisms for tuning backpressure behavior in the form of the highWaterMark option and customizable size calculations, but these are just as easy to ignore as desiredSize , and many applications simply fail to pay attention to them. The same issues exist on the WritableStream side. A WritableStream has a highWaterMark and desiredSize . There is a writer.ready promise that producers of data are supposed to pay attention but often don't. const writable = getWritableStreamSomehow(); const writer = writable.getWriter(); // Producers are supposed to wait for the writer.ready // It is a promise that, when resolves, indicates that // the writables internal backpressure is cleared and // it is ok to write more data await writer.ready; await writer.write(...); For implementers, backpressure adds complexity without providing guarantees. The machinery to track queue sizes, compute desiredSize , and invoke pull() at the right times must all be implemented correctly. However, since these signals are advisory, all that work doesn't actually prevent the problems backpressure is supposed to solve. The hidden cost of promises The Web streams spec requires promise creation at numerous points, often in hot paths and often invisible to users. Each read() call doesn't just return a promise; internally, the implementation creates additional promises for queue management, pull() coordination, and backpressure signaling. This overhead is mandated by the spec's reliance on promises for buffer management, completion, and backpressure signals. While some of it is implementation-specific, much of it is unavoidable if you're following the spec as written. For high-frequency streaming – video frames, network packets, real-time data – this overhead is significant. The problem compounds in pipelines. Each TransformStream adds another layer of promise machinery between source and sink. The spec doesn't define synchronous fast paths, so even when data is available immediately, the promise machinery still runs. For implementers, this promise-heavy design constrains optimization opportunities. The spec mandates specific promise resolution ordering, making it difficult to batch operations or skip unnecessary async boundaries without risking subtle compliance failures. There are many hidden internal optimizations that implementers do make but these can be complicated and difficult to get right. While I was writing this blog post, Vercel's Malte Ubl published their own blog post describing some research work Vercel has been doing around improving the performance of Node.js' Web streams implementation. In that post they discuss the same fundamental performance optimization problem that every implementation of Web streams face: \"Or consider pipeTo(). Each chunk passes through a full Promise chain: read, write, check backpressure, repeat. An {value, done} result object is allocated per read. Error propagation creates additional Promise branches. None of this is wrong. These guarantees matter in the browser where streams cross security boundaries, where cancellation semantics need to be airtight, where you do not control both ends of a pipe. But on the server, when you are piping React Server Components through three transforms at 1KB chunks, the cost adds up. We benchmarked native WebStream pipeThrough at 630 MB/s for 1KB chunks. Node.js pipeline() with the same passthrough transform: ~7,900 MB/s. That is a 12x gap, and the difference is almost entirely Promise and object allocation overhead.\" - Malte Ubl, https://vercel.com/blog/we-ralph-wiggumed-webstreams-to-make-them-10x-faster As part of their research, they have put together a set of proposed improvements for Node.js' Web streams implementation that will eliminate promises in certain code paths which can yield a significant performance boost up to 10x faster, which only goes to prove the point: promises, while useful, add significant overhead. As one of the core maintainers of Node.js, I am looking forward to helping Malte and the folks at Vercel get their proposed improvements landed! In a recent update made to Cloudflare Workers, I made similar kinds of modifications to an internal data pipeline that reduced the number of JavaScript promises created in certain application scenarios by up to 200x. The result is several orders of magnitude improvement in performance in those applications. Real-world failures Exhausting resources with unconsumed bodies When fetch() returns a response, the body is a ReadableStream . If you only check the status and don't consume or cancel the body, what happens? The answer varies by implementation, but a common outcome is resource leakage. async function checkEndpoint(url) { const response = await fetch(url); return response.ok; // Body is never consumed or cancelled } // In a loop, this can exhaust connection pools for (const url of urls) { await checkEndpoint(url); } This pattern has caused connection pool exhaustion in Node.js applications using undici (the fetch() implementation built into Node.js), and similar issues have appeared in other runtimes. The stream holds a reference to the underlying connection, and without explicit consumption or cancellation, the connection may linger until garbage collection – which may not happen soon enough under load. The problem is compounded by APIs that implicitly create stream branches. Request.clone() and Response.clone() perform implicit tee() operations on the body stream – a detail that's easy to miss. Code that clones a request for logging or retry logic may unknowingly create branched streams that need independent consumption, multiplying the resource management burden. Now, to be certain, these types of issues are implementation bugs. The connection leak was definitely something that undici needed to fix in its own implementation, but the complexity of the specification does not make dealing with these types of issues easy. \"Cloning streams in Node.js's fetch() implementation is harder than it looks. When you clone a request or response body, you're calling tee() - which splits a single stream into two branches that both need to be consumed. If one consumer reads faster than the other, data buffers unbounded in memory waiting for the slow branch. If you don't properly consume both branches, the underlying connection leaks. The coordination required between two readers sharing one source makes it easy to accidentally break the original request or exhaust connection pools. It's a simple API call with complex underlying mechanics that are difficult to get right.\" - Matteo Collina, Ph.D. - Platformatic Co-Founder & CTO, Node.js Technical Steering Committee Chair Falling headlong off the tee() memory cliff tee() splits a stream into two branches. It seems straightforward, but the implementation requires buffering: if one branch is read faster than the other, the data must be held somewhere until the slower branch catches up. const [forHash, forStorage] = response.body.tee(); // Hash computation is fast const hash = await computeHash(forHash); // Storage write is slow — meanwhile, the entire stream // may be buffered in memory waiting for this branch await writeToStorage(forStorage); The spec does not mandate buffer limits for tee() . And to be fair, the spec allows implementations to implement the actual internal mechanisms for tee() and other APIs in any way they see fit so long as the observable normative requirements of the specification are met. But if an implementation chooses to implement tee() in the specific way described by the streams specification, then tee() will come with a built-in memory management issue that is difficult to work around. Implementations have had to develop their own strategies for dealing with this. Firefox initially used a linked-list approach that led to O (n) memory growth proportional to the consumption rate difference. In Cloudflare Workers, we opted to implement a shared buffer model where backpressure is signaled by the slowest consumer rather than the fastest. Transform backpressure gaps TransformStream creates a readable/writable pair with processing logic in between. The transform() function executes on write , not on read. Processing of the transform happens eagerly as data arrives, regardless of whether any consumer is ready. This causes unnecessary work when consumers are slow, and the backpressure signaling between the two sides has gaps that can cause unbounded buffering under load. The expectation in the spec is that the producer of the data being transformed is paying attention to the writer.ready signal on the writable side of the transform but quite often producers just simply ignore it. If the transform's transform() operation is synchronous and always enqueues output immediately, it never signals backpressure back to the writable side even when the downstream consumer is slow. This is a consequence of the spec design that many developers completely overlook. In browsers, where there's only a single user and typically only a small number of stream pipelines active at any given time, this type of foot gun is often of no consequence, but it has a major impact on server-side or edge performance in runtimes that serve thousands of concurrent requests. const fastTransform = new TransformStream({ transform(chunk, controller) { // Synchronously enqueue — this never applies backpressure // Even if the readable side's buffer is full, this succeeds controller.enqueue(processChunk(chunk)); } }); // Pipe a fast source through the transform to a slow sink fastSource .pipeThrough(fastTransform) .pipeTo(slowSink); // Buffer grows without bound What TransformStreams are supposed to do is check for backpressure on the controller and use promises to communicate that back to the writer: const fastTransform = new TransformStream({ async transform(chunk, controller) { if (controller.desiredSize <= 0) { // Wait on the backpressure to clear somehow } controller.enqueue(processChunk(chunk)); } }); A difficulty here, however, is that the TransformStreamDefaultController does not have a ready promise mechanism like Writers do; so the TransformStream implementation would need to implement a polling mechanism to periodically check when controller.desiredSize becomes positive again. The problem gets worse in pipelines. When you chain multiple transforms – say, parse, transform, then serialize – each TransformStream has its own internal readable and writable buffers. If implementers follow the spec strictly, data cascades through these buffers in a push-oriented fashion: the source pushes to transform A, which pushes to transform B, which pushes to transform C, each accumulating data in intermediate buffers before the final consumer has even started pulling. With three transforms, you can have six internal buffers filling up simultaneously. Developers using the streams API are expected to remember to use options like highWaterMark when creating their sources, transforms, and writable destinations but often they either forget or simply choose to ignore it. source .pipeThrough(parse) // buffers filling... .pipeThrough(transform) // more buffers filling... .pipeThrough(serialize) // even more buffers... .pipeTo(destination); // consumer hasn't started yet Implementations have found ways to optimize transform pipelines by collapsing identity transforms, short-circuiting non-observable paths, deferring buffer allocation, or falling back to native code that does not run JavaScript at all. Deno, Bun, and Cloudflare Workers have all successfully implemented \"native path\" optimizations that can help eliminate much of the overhead, and Vercel's recent fast-webstreams research is working on similar optimizations for Node.js. But the optimizations themselves add significant complexity and still can't fully escape the inherently push-oriented model that TransformStream uses. GC thrashing in server-side rendering Streaming server-side rendering (SSR) is a particularly painful case. A typical SSR stream might render thousands of small HTML fragments, each passing through the streams machinery: // Each component enqueues a small chunk function renderComponent(controller) { controller.enqueue(encoder.encode(`<div>${content}</div>`)); } // Hundreds of components = hundreds of enqueue calls // Each one triggers promise machinery internally for (const component of components) { renderComponent(controller); // Promises created, objects allocated } Every fragment means promises created for read() calls, promises for backpressure coordination, intermediate buffer allocations, and { value, done } result objects – most of which become garbage almost immediately. Under load, this creates GC pressure that can devastate throughput. The JavaScript engine spends significant time collecting short-lived objects instead of doing useful work. Latency becomes unpredictable as GC pauses interrupt request handling. I've seen SSR workloads where garbage collection accounts for a substantial portion (up to and beyond 50%) of total CPU time per request. That's time that could be spent actually rendering content. The irony is that streaming SSR is supposed to improve performance by sending content incrementally. But the overhead of the streams machinery can negate those gains, especially for pages with many small components. Developers sometimes find that buffering the entire response is actually faster than streaming through Web streams, defeating the purpose entirely. The optimization treadmill To achieve usable performance, every major runtime has resorted to non-standard internal optimizations for Web streams. Node.js, Deno, Bun, and Cloudflare Workers have all developed their own workarounds. This is particularly true for streams wired up to system-level I/O, where much of the machinery is non-observable and can be short-circuited. Finding these optimization opportunities can itself be a significant undertaking. It requires end-to-end understanding of the spec to identify which behaviors are observable and which can safely be elided. Even then, whether a given optimization is actually spec-compliant is often unclear. Implementers must make judgment calls about which semantics they can relax without breaking compatibility. This puts enormous pressure on runtime teams to become spec experts just to achieve acceptable performance. These optimizations are difficult to implement, frequently error-prone, and lead to inconsistent behavior across runtimes. Bun's \" Direct Streams \" optimization takes a deliberately and observably non-standard approach, bypassing much of the spec's machinery entirely. Cloudflare Workers' IdentityTransformStream provides a fast-path for pass-through transforms but is Workers-specific and implements behaviors that are not standard for a TransformStream . Each runtime has its own set of tricks and the natural tendency is toward non-standard solutions, because that's often the only way to make things fast. This fragmentation hurts portability. Code that performs well on one runtime may behave differently (or poorly) on another, even though it's using \"standard\" APIs. The complexity burden on runtime implementers is substantial, and the subtle behavioral differences create friction for developers trying to write cross-runtime code, particularly those maintaining frameworks that must be able to run efficiently across many runtime environments. It is also necessary to emphasize that many optimizations are only possible in parts of the spec that are unobservable to user code. The alternative, like Bun \"Direct Streams\", is to intentionally diverge from the spec-defined observable behaviors. This means optimizations often feel \"incomplete\". They work in some scenarios but not in others, in some runtimes but not others, etc. Every such case adds to the overall unsustainable complexity of the Web streams approach which is why most runtime implementers rarely put significant effort into further improvements to their streams implementations once the conformance tests are passing. Implementers shouldn't need to jump through these hoops. When you find yourself needing to relax or bypass spec semantics just to achieve reasonable performance, that's a sign something is wrong with the spec itself. A well-designed streaming API should be efficient by default, not require each runtime to invent its own escape hatches. The compliance burden A complex spec creates complex edge cases. The Web Platform Tests for streams span over 70 test files, and while comprehensive testing is a good thing, what's telling is what needs to be tested. Consider some of the more obscure tests that implementations must pass: Prototype pollution defense: One test patches Object.prototype. then to intercept promise resolutions, then verifies that pipeTo() and tee() operations don't leak internal values through the prototype chain. This tests a security property that only exists because the spec's promise-heavy internals create an attack surface. WebAssembly memory rejection: BYOB reads must explicitly reject ArrayBuffers backed by WebAssembly memory, which look like regular buffers but can't be transferred. This edge case exists because of the spec's buffer detachment model – a simpler API wouldn't need to handle it. Crash regression for state machine conflicts: A test specifically checks that calling byobRequest.respond() after enqueue() doesn't crash the runtime. This sequence creates a conflict in the internal state machine — the enqueue() fulfills the pending read and should invalidate the byobRequest , but implementations must gracefully handle the subsequent respond() rather than corrupting memory in order to cover the very likely possibility that developers are not using the complex API correctly. These aren't contrived scenarios invented by test authors in total vacuum. They're consequences of the spec's design and reflect real world bugs. For runtime implementers, passing the WPT suite means handling intricate corner cases that most application code will never encounter. The tests encode not just the happy path but the full matrix of interactions between readers, writers, controllers, queues, strategies, and the promise machinery that connects them all. A simpler API would mean fewer concepts, fewer interactions between concepts, and fewer edge cases to get right resulting in more confidence that implementations actually behave consistently. The takeaway Web streams are complex for users and implementers alike. The problems with the spec aren't bugs. They emerge from using the API exactly as designed. They aren't issues that can be fixed solely through incremental improvements. They're consequences of fundamental design choices. To improve things we need different foundations. A better streams API is possible After implementing the Web streams spec multiple times across different runtimes and seeing the pain points firsthand, I decided it was time to explore what a better, alternative streaming API could look like if designed from first principles today. What follows is a proof of concept: it's not a finished standard, not a production-ready library, not even necessarily a concrete proposal for something new, but a starting point for discussion that demonstrates the problems with Web streams aren't inherent to streaming itself; they're consequences of specific design choices that could be made differently. Whether this exact API is the right answer is less important than whether it sparks a productive conversation about what we actually need from a streaming primitive. What is a stream? Before diving into API design, it's worth asking: what is a stream? At its core, a stream is just a sequence of data that arrives over time. You don't have all of it at once. You process it incrementally as it becomes available. Unix pipes are perhaps the purest expression of this idea: cat access.log | grep \"error\" | sort | uniq -c Data flows left to right. Each stage reads input, does its work, writes output. There's no pipe reader to acquire, no controller lock to manage. If a downstream stage is slow, upstream stages naturally slow down as well. Backpressure is implicit in the model, not a separate mechanism to learn (or ignore). In JavaScript, the natural primitive for \"a sequence of things that arrive over time\" is already in the language: the async iterable. You consume it with for await...of . You stop consuming by stopping iteration. This is the intuition the new API tries to preserve: streams should feel like iteration, because that's what they are. The complexity of Web streams – readers, writers, controllers, locks, queuing strategies – obscures this fundamental simplicity. A better API should make the simple case simple and only add complexity where it's genuinely needed. Design principles I built the proof-of-concept alternative around a different set of principles. Streams are iterables. No custom ReadableStream class with hidden internal state. A readable stream is just an AsyncIterable<Uint8Array[]> . You consume it with for await...of . No readers to acquire, no locks to manage. Pull-through transforms Transforms don't execute until the consumer pulls. There's no eager evaluation, no hidden buffering. Data flows on-demand from source, through transforms, to the consumer. If you stop iterating, processing stops. Explicit backpressure Backpressure is strict by default. When a buffer is full, writes reject rather than silently accumulating. You can configure alternative policies – block until space is available, drop oldest, drop newest – but you have to choose explicitly. No more silent memory growth. Batched chunks Instead of yielding one chunk per iteration, streams yield Uint8Array[]: arrays of chunks. This amortizes the async overhead across multiple chunks, reducing promise creation and microtask latency in hot paths. Bytes only The API deals exclusively with bytes ( Uint8Array ). Strings are UTF-8 encoded automatically. There's no \"value stream\" vs \"byte stream\" dichotomy. If you want to stream arbitrary JavaScript values, use async iterables directly. While the API uses Uint8Array , it treats chunks as opaque. There is no partial consumption, no BYOB patterns, no byte-level operations within the streaming machinery itself. Chunks go in, chunks come out, unchanged unless a transform explicitly modifies them. Synchronous fast paths matter The API recognizes that synchronous data sources are both necessary and common. The application should not be forced to always accept the performance cost of asynchronous scheduling simply because that's the only option provided. At the same time, mixing sync and async processing can be dangerous. Synchronous paths should always be an option and should always be explicit. The new API in action Creating and consuming streams In Web streams, creating a simple producer/consumer pair requires TransformStream , manual encoding, and careful lock management: const { readable, writable } = new TransformStream(); const enc = new TextEncoder(); const writer = writable.getWriter(); await writer.write(enc.encode(\"Hello, World!\")); await writer.close(); writer.releaseLock(); const dec = new TextDecoder(); let text = ''; for await (const chunk of readable) { text += dec.decode(chunk, { stream: true }); } text += dec.decode(); Even this relatively clean version requires: a TransformStream , manual TextEncoder and TextDecoder , and explicit lock release. Here's the equivalent with the new API: import { Stream } from 'new-streams'; // Create a push stream const { writer, readable } = Stream.push(); // Write data — backpressure is enforced await writer.write(\"Hello, World!\"); await writer.end(); // Consume as text const text = await Stream.text(readable); The readable is just an async iterable. You can pass it to any function that expects one, including Stream.text() which collects and decodes the entire stream. The writer has a simple interface: write(), writev() for batched writes, end() to signal completion, and abort() for errors. That's essentially it. The Writer is not a concrete class. Any object that implements write() , end() , and abort() can be a writer making it easy to adapt existing APIs or create specialized implementations without subclassing. There's no complex UnderlyingSink protocol with start() , write() , close() , and abort() callbacks that must coordinate through a controller whose lifecycle and state are independent of the WritableStream it is bound to. Here's a simple in-memory writer that collects all written data: // A minimal writer implementation — just an object with methods function createBufferWriter() { const chunks = []; let totalBytes = 0; let closed = false; const addChunk = (chunk) => { chunks.push(chunk); totalBytes += chunk.byteLength; }; return { get desiredSize() { return closed ? null : 1; }, // Async variants write(chunk) { addChunk(chunk); }, writev(batch) { for (const c of batch) addChunk(c); }, end() { closed = true; return totalBytes; }, abort(reason) { closed = true; chunks.length = 0; }, // Sync variants return boolean (true = accepted) writeSync(chunk) { addChunk(chunk); return true; }, writevSync(batch) { for (const c of batch) addChunk(c); return true; }, endSync() { closed = true; return totalBytes; }, abortSync(reason) { closed = true; chunks.length = 0; return true; }, getChunks() { return chunks; } }; } // Use it const writer = createBufferWriter(); await Stream.pipeTo(source, writer); const allData = writer.getChunks(); No base class to extend, no abstract methods to implement, no controller to coordinate with. Just an object with the right shape. Pull-through transforms Under the new API design, transforms should not perform any work until the data is being consumed. This is a fundamental principle. // Nothing executes until iteration begins const output = Stream.pull(source, compress, encrypt); // Transforms execute as we iterate for await (const chunks of output) { for (const chunk of chunks) { process(chunk); } } Stream.pull() creates a lazy pipeline. The compress and encrypt transforms don't run until you start iterating output. Each iteration pulls data through the pipeline on demand. This is fundamentally different from Web streams' pipeThrough() , which starts actively pumping data from the source to the transform as soon as you set up the pipe. Pull semantics mean you control when processing happens, and stopping iteration stops processing. Transforms can be stateless or stateful. A stateless transform is just a function that takes chunks and returns transformed chunks: // Stateless transform — a pure function // Receives chunks or null (flush signal) const toUpperCase = (chunks) => { if (chunks === null) return null; // End of stream return chunks.map(chunk => { const str = new TextDecoder().decode(chunk); return new TextEncoder().encode(str.toUpperCase()); }); }; // Use it directly const output = Stream.pull(source, toUpperCase); Stateful transforms are simple objects with member functions that maintain state across calls: // Stateful transform — a generator that wraps the source function createLineParser() { // Helper to concatenate Uint8Arrays const concat = (...arrays) => { const result = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0)); let offset = 0; for (const arr of arrays) { result.set(arr, offset); offset += arr.length; } return result; }; return { async *transform(source) { let pending = new Uint8Array(0); for await (const chunks of source) { if (chunks === null) { // Flush: yield any remaining data if (pending.length > 0) yield [pending]; continue; } // Concatenate pending data with new chunks const combined = concat(pending, ...chunks); const lines = []; let start = 0; for (let i = 0; i < combined.length; i++) { if (combined[i] === 0x0a) { // newline lines.push(combined.slice(start, i)); start = i + 1; } } pending = combined.slice(start); if (lines.length > 0) yield lines; } } }; } const output = Stream.pull(source, createLineParser()); For transforms that need cleanup on abort, add an abort handler: // Stateful transform with resource cleanup function createGzipCompressor() { // Hypothetical compression API... const deflate = new Deflater({ gzip: true }); return { async *transform(source) { for await (const chunks of source) { if (chunks === null) { // Flush: finalize compression deflate.push(new Uint8Array(0), true); if (deflate.result) yield [deflate.result]; } else { for (const chunk of chunks) { deflate.push(chunk, false); if (deflate.result) yield [deflate.result]; } } } }, abort(reason) { // Clean up compressor resources on error/cancellation } }; } For implementers, there's no Transformer protocol with start() , transform() , flush() methods and controller coordination passed into a TransformStream class that has its own hidden state machine and buffering mechanisms. Transforms are just functions or simple objects: far simpler to implement and test. Explicit backpressure policies When a bounded buffer fills up and a producer wants to write more, there are only a few things you can do: Reject the write: refuse to accept more data Wait: block until space becomes available Discard old data: evict what's already buffered to make room Discard new data: drop what's incoming That's it. Any other response is either a variation of these (like \"resize the buffer,\" which is really just deferring the choice) or domain-specific logic that doesn't belong in a general streaming primitive. Web streams currently always choose Wait by default. The new API makes you choose one of these four explicitly: strict (default): Rejects writes when the buffer is full and too many writes are pending. Catches \"fire-and-forget\" patterns where producers ignore backpressure. block : Writes wait until buffer space is available. Use when you trust the producer to await writes properly. drop-oldest : Drops the oldest buffered data to make room. Useful for live feeds where stale data loses value. drop-newest : Discards incoming data when full. Useful when you want to process what you have without being overwhelmed. const { writer, readable } = Stream.push({ highWaterMark: 10, backpressure: 'strict' // or 'block', 'drop-oldest', 'drop-newest' }); No more hoping producers cooperate. The policy you choose determines what happens when the buffer fills. Here's how each policy behaves when a producer writes faster than the consumer reads: // strict: Catches fire-and-forget writes that ignore backpressure const strict = Stream.push({ highWaterMark: 2, backpressure: 'strict' }); strict.writer.write(chunk1); // ok (not awaited) strict.writer.write(chunk2); // ok (fills slots buffer) strict.writer.write(chunk3); // ok (queued in pending) strict.writer.write(chunk4); // ok (pending buffer fills) strict.writer.write(chunk5); // throws! too many pending writes // block: Wait for space (unbounded pending queue) const blocking = Stream.push({ highWaterMark: 2, backpressure: 'block' }); await blocking.writer.write(chunk1); // ok await blocking.writer.write(chunk2); // ok await blocking.writer.write(chunk3); // waits until consumer reads await blocking.writer.write(chunk4); // waits until consumer reads await blocking.writer.write(chunk5); // waits until consumer reads // drop-oldest: Discard old data to make room const dropOld = Stream.push({ highWaterMark: 2, backpressure: 'drop-oldest' }); await dropOld.writer.write(chunk1); // ok await dropOld.writer.write(chunk2); // ok await dropOld.writer.write(chunk3); // ok, chunk1 discarded // drop-newest: Discard incoming data when full const dropNew = Stream.push({ highWaterMark: 2, backpressure: 'drop-newest' }); await dropNew.writer.write(chunk1); // ok await dropNew.writer.write(chunk2); // ok await dropNew.writer.write(chunk3); // silently dropped Explicit Multi-consumer patterns // Share with explicit buffer management const shared = Stream.share(source, { highWaterMark: 100, backpressure: 'strict' }); const consumer1 = shared.pull(); const consumer2 = shared.pull(decompress); Instead of tee() with its hidden unbounded buffer, you get explicit multi-consumer primitives. Stream.share() is pull-based: consumers pull from a shared source, and you configure the buffer limits and backpressure policy upfront. There's also Stream.broadcast() for push-based multi-consumer scenarios. Both require you to think about what happens when consumers run at different speeds, because that's a real concern that shouldn't be hidden. Sync/async separation Not all streaming workloads involve I/O. When your source is in-memory and your transforms are pure functions, async machinery adds overhead without benefit. You're paying for coordination of \"waiting\" that adds no benefit. The new API has complete parallel sync versions: Stream.pullSync() , Stream.bytesSync() , Stream.textSync() , and so on. If your source and transforms are all synchronous, you can process the entire pipeline without a single promise. // Async — when source or transforms may be asynchronous const textAsync = await Stream.text(source); // Sync — when all components are synchronous const textSync = Stream.textSync(source); Here's a complete synchronous pipeline – compression, transformation, and consumption with zero async overhead: // Synchronous source from in-memory data const source = Stream.fromSync([inputBuffer]); // Synchronous transforms const compressed = Stream.pullSync(source, zlibCompressSync); const encrypted = Stream.pullSync(compressed, aesEncryptSync); // Synchronous consumption — no promises, no event loop trips const result = Stream.bytesSync(encrypted); The entire pipeline executes in a single call stack. No promises are created, no microtask queue scheduling occurs, and no GC pressure from short-lived async machinery. For CPU-bound workloads like parsing, compression, or transformation of in-memory data, this can be significantly faster than the equivalent Web streams code – which would force async boundaries even when every component is synchronous. Web streams has no synchronous path. Even if your source has data ready and your transform is a pure function, you still pay for promise creation and microtask scheduling on every operation. Promises are fantastic for cases in which waiting is actually necessary, but they aren't always necessary. The new API lets you stay in sync-land when that's what you need. Bridging the gap between this and web streams The async iterator based approach provides a natural bridge between this alternative approach and Web streams. When coming from a ReadableStream to this new approach, simply passing the readable in as input works as expected when the ReadableStream is set up to yield bytes: const readable = getWebReadableStreamSomehow(); const input = Stream.pull(readable, transform1, transform2); for await (const chunks of input) { // process chunks } When adapting to a ReadableStream, a bit more work is required since the alternative approach yields batches of chunks, but the adaptation layer is as easily straightforward: async function* adapt(input) { for await (const chunks of input) { for (const chunk of chunks) { yield chunk; } } } const input = Stream.pull(source, transform1, transform2); const readable = ReadableStream.from(adapt(input)); How this addresses the real-world failures from earlier Unconsumed bodies: Pull semantics mean nothing happens until you iterate. No hidden resource retention. If you don't consume a stream, there's no background machinery holding connections open. The tee() memory cliff: Stream.share() requires explicit buffer configuration. You choose the highWaterMark and backpressure policy upfront: no more silent unbounded growth when consumers run at different speeds. Transform backpressure gaps: Pull-through transforms execute on-demand. Data doesn't cascade through intermediate buffers; it flows only when the consumer pulls. Stop iterating, stop processing. GC thrashing in SSR: Batched chunks ( Uint8Array[] ) amortize async overhead. Sync pipelines via Stream.pullSync() eliminate promise allocation entirely for CPU-bound workloads. Performance The design choices have performance implications. Here are benchmarks from the reference implementation of this possible alternative compared to Web streams (Node.js v24.x, Apple M1 Pro, averaged over 10 runs): Scenario Alternative Web streams Difference Small chunks (1KB × 5000) ~13 GB/s ~4 GB/s ~3× faster Tiny chunks (100B × 10000) ~4 GB/s ~450 MB/s ~8× faster Async iteration (8KB × 1000) ~530 GB/s ~35 GB/s ~15× faster Chained 3× transforms (8KB × 500) ~275 GB/s ~3 GB/s ~80–90× faster High-frequency (64B × 20000) ~7.5 GB/s ~280 MB/s ~25× faster The chained transform result is particularly striking: pull-through semantics eliminate the intermediate buffering that plagues Web streams pipelines. Instead of each TransformStream eagerly filling its internal buffers, data",
+    "quality_score": 9,
+    "modules": [
+      "js_advanced",
+      "design_patterns",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/improving-web-standards-urlpattern/",
+    "title": "New URLPattern API brings improved pattern matching to Node.js and Cloudflare Workers",
+    "source_name": "Cloudflare Blog",
+    "text": "2025-03-24 4 min read Today, we are excited to announce that we have contributed an implementation of the URLPattern API to Node.js, and it is available starting with the v23.8.0 update . We've done this by adding our URLPattern implementation to Ada URL , the high-performance URL parser that now powers URL handling in both Node.js and Cloudflare Workers. This marks an important step toward bringing this API to the broader JavaScript ecosystem. Cloudflare Workers has, from the beginning, embraced a standards-based JavaScript programming model, and Cloudflare was one of the founding companies for what has evolved into ECMA's 55th Technical Committee , focusing on interoperability between Web-interoperable runtimes like Workers, Node.js, Deno, and others. This contribution highlights and marks our commitment to this ongoing philosophy. Ensuring that all the JavaScript runtimes work consistently and offer at least a minimally consistent set of features is critical to ensuring the ongoing health of the ecosystem as a whole. URLPattern API contribution is just one example of Cloudflare’s ongoing commitment to the open-source ecosystem. We actively contribute to numerous open-source projects including Node.js, V8, and Ada URL, while also maintaining our own open-source initiatives like workerd and wrangler . By upstreaming improvements to foundational technologies that power the web, we strengthen the entire developer ecosystem while ensuring consistent features across JavaScript runtimes. This collaborative approach reflects our belief that open standards and shared implementations benefit everyone - reducing fragmentation, improving developer experience and creating a better Internet. What is URLPattern? URLPattern is a standard published by the WHATWG (Web Hypertext Application Technology Working Group) which provides a pattern-matching system for URLs. This specification is available at urlpattern.spec.whatwg.org . The API provides developers with an easy-to-use, regular expression (regex) -based approach to handling route matching, with built-in support for named parameters, wildcards, and more complex pattern matching that works uniformly across all URL components. URLPattern is part of the WinterTC Minimum Common API , a soon-to-be standardized subset of web platform APIs designed to ensure interoperability across JavaScript runtimes, particularly for server-side and non-browser environments, and includes other APIs such as URL and URLSearchParams . Cloudflare Workers has supported URLPattern for a number of years now, reflecting our commitment to enabling developers to use standard APIs across both browsers and server-side JavaScript runtimes. Contributing to Node.js and unifying the URLPattern implementation simplifies the ecosystem by reducing fragmentation, while at the same time improving our own implementation in Cloudflare Workers by making it faster and more specification compliant. The following example demonstrates how URLPattern is used by creating a pattern that matches URLs with a “/blog/:year/:month/:slug” path structure, then tests if one specific URL string matches this pattern, and extracts the named parameters from a second URL using the exec method. const pattern = new URLPattern({ pathname: '/blog/:year/:month/:slug' }); if (pattern.test('https://example.com/blog/2025/03/urlpattern-launch')) { console.log('Match found!'); } const result = pattern.exec('https://example.com/blog/2025/03/urlpattern-launch'); console.log(result.pathname.groups.year); // \"2025\" console.log(result.pathname.groups.month); // \"03\" console.log(result.pathname.groups.slug); // \"urlpattern-launch\" The URLPattern constructor accepts pattern strings or objects defining patterns for individual URL components. The test() method returns a boolean indicating if a URL simply matches the pattern. The exec() method provides detailed match results including captured groups. Behind this simple API, there’s sophisticated machinery working behind the scenes: When a URLPattern is used, it internally breaks down a URL, matching it against eight distinct components: protocol, username, password, hostname, port, pathname, search, and hash. This component-based approach gives the developer control over which parts of a URL to match. Upon creation of the instance, URLPattern parses your input patterns for each component and compiles them internally into eight specialized regular expressions (one for each component type). This compilation step happens just once when you create an URLPattern object, optimizing subsequent matching operations. During a match operation (whether using test() or exec() ), these regular expressions are used to determine if the input matches the given properties. The test() method tells you if there’s a match, while exec() provides detailed information about what was matched, including any named capture groups from your pattern. Fixing things along the way While implementing URLPattern, we discovered some inconsistencies between the specification and the web-platform tests , a cross-browser test suite maintained by all major browsers to test conformance to web standard specifications. For instance, we found that URLs with non-special protocols (opaque-paths) and URLs with invalid characters in hostnames were not correctly defined and processed within the URLPattern specification. We worked actively with the Chromium and the Safari teams to address these issues. URLPatterns constructed from hostname components that contain newline or tab characters were expected to fail in the corresponding web-platform tests. This was due to an inconsistency with the original URLPattern implementation and the URLPattern specification. const pattern = new URL({ \"hostname\": \"bad\\nhostname\" }); const matched = pattern.test({ \"hostname\": \"badhostname\" }); // This now returns true. We opened several issues to document these inconsistencies and followed up with a pull-request to fix the specification , ensuring that all implementations will eventually converge on the same corrected behavior. This also resulted in fixing several inconsistencies in web-platform tests, particularly around handling certain types of white space (such as newline or tab characters) in hostnames. Getting started with URLPattern If you’re interested in using URLPattern today, you can: Use it natively in modern browsers by accessing the global URLPattern class Try it in Cloudflare Workers (which has had URLPattern support for some time, now with improved spec compliance and performance) Try it in Node.js, starting from v23.8.0 Try it in NativeScript on iOS and Android, starting from v8.9.0 Try it in Deno Here is a more complex example showing how URLPattern can be used for routing in a Cloudflare Worker — a common use case when building API endpoints or web applications that need to handle different URL paths efficiently and differently. The following example shows a pattern for REST APIs that matches both “/users” and “/users/:userId” const routes = [ new URLPattern({ pathname: '/users{/:userId}?' }), ]; export default { async fetch(request, env, ctx): Promise<Response> { const url = new URL(request.url); for (const route of routes) { const match = route.exec(url); if (match) { const { userId } = match.pathname.groups; if (userId) { return new Response(`User ID: ${userId}`); } return new Response('List of users'); } } // No matching route found return new Response('Not Found', { status: 404 }); }, } satisfies ExportedHandler<Env>; What does the future hold? The contribution of URLPattern to Ada URL and Node.js is just the beginning. We’re excited about the possibilities this opens up for developers across different JavaScript environments. In the future, we expect to contribute additional improvements to URLPattern’s performance, enabling more use cases for web application routing. Additionally, efforts to standardize the URLPatternList proposal will help deliver faster matching capabilities for server-side runtimes. We’re excited about these developments and encourage you to try URLPattern in your projects today. Try it and let us know what you think by creating an issue on the workerd repository . Your feedback is invaluable as we work to further enhance URLPattern. We hope to do our part to build a unified Javascript ecosystem, and encourage others to do the same. This may mean looking for opportunities, such as we have with URLPattern, to share API implementations across backend runtimes. It could mean using or contributing to web-platform-tests if you are working on a server-side runtime or web-standard APIs, or it might mean joining WinterTC to help define web-interoperable standards for server-side JavaScript. Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Node.js JavaScript Cloudflare Workers Standards",
+    "quality_score": 8,
+    "modules": [
+      "js_advanced",
+      "api_design",
+      "clean_code"
+    ]
+  },
+  {
+    "url": "https://github.blog/engineering/engineering-principles/github-enterprise-cloud-with-data-residency/",
+    "title": "GitHub Enterprise Cloud with data residency: How we built the next evolution of GitHub Enterprise using GitHub",
+    "source_name": "The GitHub Blog",
+    "text": "How we used GitHub to build GitHub Enterprise Cloud with data residency. September 23, 2024 | Updated September 26, 2024 | 7 minutes Share: Today, we announced that GitHub Enterprise Cloud will offer data residency , starting with the European Union (EU) on October 29, 2024, to address a critical desire from customers and enable an optimal, unified experience on GitHub for our customers. Data residency and what it means for developers We’ve heard for years from enterprises that being able to control where their data resides is critical for them. With data residency, organizations can now store their GitHub code and repository data in their preferred geographical region. With this need met, even more developers across the globe can build on the world’s AI-powered developer platform. Enterprise Cloud with data residency provides enhanced user control and unique namespaces on ghe.com isolated from the open source cloud on github.com. It’s built on the security, business continuity, and disaster recovery capabilities of Microsoft Azure. This is a huge milestone for our customers and for GitHub–a multi-year effort that required extensive time, effort, and dedication across the company. We’re excited to share a behind-the-scenes look at how we leveraged GitHub to develop the next evolution of Enterprise Cloud. Designing the architecture for the next evolution of GitHub Enterprise This effort started in summer of 2022 with a proof of concept (PoC) and involved teams across GitHub. We carefully considered which architecture would enable us to be successful. After iterating with different approaches, we decided to build the new offering as a feature set that extends Enterprise Cloud. This approach would allow us to be consistently in sync with features on github.com and provide the performance, reliability, and security that our customers expect. For hosting, we effectively leveraged Microsoft Azure’s scale, security, and regional footprint to produce a reliable and secured product with data residency built-in, without having to build new data centers ourselves. As the home for all developers, developer experience is critically important for us. We recognized early on that consistency was important, so we sought to minimize differences in developing for Enterprise Cloud and Enterprise Cloud with data residency. To this end, the architecture across both is very similar, reducing complexity, risk, and development costs. The deployment model is familiar to our developers: it builds off of GitHub Actions. Also, changes to github.com and Enterprise Cloud with data residency are deployed minutes apart as part of a unified pipeline. To accomplish this, we had to organize the work, modify our build and deployment systems, and validate the quality of the platform. We were able to do all three of these by using GitHub. Organizing with GitHub Issues and Projects To organize the project, we used GitHub Issues and Projects , taking advantage of multiple views to effectively drive work across multiple projects, more than 100 teams, and over 2,000 issues. Different stakeholders and teams could take advantage of these views to focus on the information most relevant to them. Our talented technical project management team helped coordinate updates and used the filtering and slicing capabilities of Projects to present continuously updated information for each milestone in an easily consumable way. We also used upcoming features like issues hierarchy to help us understand relationships between issues, and issue types to help clearly classify issues across repositories. As part of using these features internally we were able to give feedback to the teams working on them and refine the final product. Keep an eye out for future announcements for issues hierarchy and issue types coming soon! All of these powerful features helped us keep the initiative on track. We were able to clearly understand potential risk areas and partner across multiple teams to resolve blockers and complex dependencies, keeping the project effectively moving forward across multiple years. Building Enterprise Cloud with data residency using GitHub GitHub has always been built using GitHub . We wanted to continue this practice to set ourselves up for success with the new data residency feature. To this end, we continued leveraging GitHub Codespaces for development and GitHub Actions for continuous integration (CI). In addition, we added deployment targets for new regions. This produced a development, testing, and CI model that required no changes for our developers and a deployment process that was tightly integrated into the existing flow. We have previously discussed our deploy then merge model, where we deploy branches before merging into the main branch. We expanded this approach to include successful deployments to Enterprise Cloud data residency targets before changes could be merged and considered complete, continuing to use the existing GitHub merge queue . A visualization of our monolithic deployment pipeline is shown in the figure below. We start by deploying to environments used by GitHub employees in parallel. This includes the internal environment for Enterprise Cloud with data residency discussed more in the next section. As we use GitHub every day to build GitHub, this step helps us catch issues as employees use the product before it impacts our customers. After automated and manual testing, we proceed to roll out to “Canary.” Canary is the name for the stage where we configure our load balancers to gradually direct an increasing percentage of github.com traffic to the updated version of the code in a staged manner. Additional testing occurs in between each stage. Once we successfully deploy the updated version of github.com to all users, we then deploy and validate Enterprise Cloud with data residency in the EU before finishing the process and merging the pull request. Ensuring all deployments are successful before we merge means changes are deployed in sync across all Enterprise Cloud environments and monitored effectively. Note that in addition to deployments, we also use feature flags to gradually roll out changes to groups of customers to reduce risk. If a deployment to any target fails, we roll back the change completely. Once we have understood the failure and are ready to deploy again, the entire process starts from the beginning with the merge queue. Finally, to maintain consistency across all teams and services, we created automation to generate deployment pipelines for over 100 services so, as new targets are introduced, each service automatically deploys to the new environment in a consistent order. Using Enterprise Cloud with data residency ourselves To create the best possible product, we also prioritized using it ourselves and stood up an isolated environment for this purpose. Using our GitHub migration tooling , we moved the day-to-day development for the team working on GitHub Enterprise Importer to that environment, and invested in updating our build, deploy, and development environments to support working from the data resident environment. Since its creation, we have deployed to this environment over 8,000 times. This gave us invaluable feedback about the experience of working in the product with issues, pull requests, and actions that we were able to address early in the development process. We were also able to iterate on our status page tooling and internal Service Level Objective (SLO) process with the new environment in mind. The team is continuing to work in this environment today and runs over 1,000 actions jobs a month. This is a testament to the stability and quality we’ve been able to deliver and our commitment to this feature. What’s next We are proud that we’ve been able to evolve Enterprise Cloud to offer data residency while using GitHub to organize, build, deploy, and test it. We’re excited to unlock GitHub for even more developers and for you to experience what we have built, starting on October 29, 2024 in the EU, with more regions on the way. If you’re excited about Enterprise Cloud with data residency, please join us at GitHub Universe 2024 to learn more and hear from other companies how they’ve used this to accelerate software development and innovation. Written by VP of Engineering, GitHub Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "design_patterns",
+      "devops",
+      "integration"
+    ]
+  },
+  {
+    "url": "https://engineering.fb.com/2025/01/22/security/how-meta-discovers-data-flows-via-lineage-at-scale/",
+    "title": "How Meta discovers data flows via lineage at scale",
+    "source_name": "Engineering at Meta",
+    "text": "Data lineage is an instrumental part of Meta’s Privacy Aware Infrastructure (PAI) initiative, a suite of technologies that efficiently protect user privacy. It is a critical and powerful tool for scalable discovery of relevant data and data flows, which supports privacy controls across Meta’s systems. This allows us to verify that our users’ everyday interactions are protected across our family of apps, such as their religious views in the Facebook Dating app, the example we’ll walk through in this post. In order to build high-quality data lineage, we developed different techniques to collect data flow signals across different technology stacks: static code analysis for different languages, runtime instrumentation, and input and output data matching, etc. We then built an intuitive UX into our tooling that enables developers to effectively consume all of this lineage data in a systematic way, saving significant engineering time for building privacy controls. As we expanded PAI across Meta, we gained valuable insights about the data lineage space. Our understanding of the privacy space evolved, revealing the need for early focus on data lineage, tooling, a cohesive ecosystem of libraries, and more. These initiatives have assisted in accelerating the development of data lineage and implementing purpose limitation controls more quickly and efficiently. At Meta, we believe that privacy enables product innovation. This belief has led us to developing Privacy Aware Infrastructure (PAI) , which offers efficient and reliable first-class privacy constructs embedded in Meta infrastructure to address different privacy requirements, such as purpose limitation , which restricts the purposes for which data can be processed and used. In this blog, we will delve into an early stage in PAI implementation: data lineage . Data lineage refers to the process of tracing the journey of data as it moves through various systems, illustrating how data transitions from one data asset, such as a database table (the source asset), to another (the sink asset). We’ll also walk through how we track the lineage of users’ “religion” information in our Facebook Dating app. Millions of data assets are vital for supporting our product ecosystem, ensuring the functionality our users anticipate, maintaining high product quality, and safeguarding user safety and integrity. Data lineage enables us to efficiently navigate these assets and protect user data. It enhances the traceability of data flows within systems, ultimately empowering developers to swiftly implement privacy controls and create innovative products. Note that data lineage is dependent on having already completed important and complex preliminary steps to inventory, schematize, and annotate data assets into a unified asset catalog. This took Meta multiple years to complete across our millions of disparate data assets, and we’ll cover each of these more deeply in future blog posts: Inventorying involves collecting various code and data assets (e.g., web endpoints, data tables, AI models) used across Meta. Schematization expresses data assets in structural detail (e.g., indicating that a data asset has a field called “religion”). Annotation labels data to describe its content (e.g., specifying that the identity column contains religion data). Understanding data lineage at Meta To establish robust privacy controls, an essential part of our PAI initiative is to understand how data flows across different systems. Data lineage is part of this discovery step in the PAI workflow, as shown in the following diagram: Data lineage is a key precursor to implementing Policy Zones, our information flow control technology, because it answers the question, “ Where does my data come from and where does it go?” – helping inform the right places to apply privacy controls. In conjunction with Policy Zones, data lineage provides the following key benefits to thousands of developers at Meta: Scalable data flow discovery : Data lineage answers the question above by providing an end-to-end, scalable graph of relevant data flows. We can leverage the lineage graphs to visualize and explain the flow of relevant data from the point where it is collected to all the places where it is processed. Efficient rollout of privacy controls : By leveraging data lineage to track data flows, we can easily pinpoint the optimal integration points for privacy controls like Policy Zones within the codebase, streamlining the rollout process. Thus we have developed a powerful flow discovery tool as part of our PAI tool suite, Policy Zone Manager (PZM), based on data lineage. PZM enables developers to rapidly identify multiple downstream assets from a set of sources simultaneously, thereby accelerating the rollout process of privacy controls. Continuous compliance verification : Once the privacy requirement has been fully implemented, data lineage plays a vital role in monitoring and validating data flows continuously, in addition to the enforcement mechanisms such as Policy Zones. Traditionally, data lineage has been collected via code inspection using manually authored data flow diagrams and spreadsheets. However, this approach does not scale in large and dynamic environments, such as Meta, with billions of lines of continuously evolving code. To tackle this challenge, we’ve developed a robust and scalable lineage solution that uses static code analysis signals as well as runtime signals. Walkthrough: Implementing data lineage for religion data We’ll share how we have automated lineage tracking to identify religion data flows through our core systems, eventually creating an end-to-end, precise view of downstream religion assets being protected, via the following two key stages: Collecting data flow signals : a process to capture data flow signals from many processing activities across different systems, not only for religion, but for all other types of data, to create an end-to-end lineage graph. Identifying relevant data flows : a process to identify the specific subset of data flows (“subgraph”) within the lineage graph that pertains to religion. These stages propagate through various systems including function-based systems that load, process, and propagate data through stacks of function calls in different programming languages (e.g., Hack, C++, Python, etc.) such as web systems and backend services, and batch-processing systems that process data rows in batch (mainly via SQL) such as data warehouse and AI systems. For simplicity, we will demonstrate these for the web, the data warehouse, and AI, per the diagram below. Collecting data flow signals for the web system When setting up a profile on the Facebook Dating app, people can populate their religious views. This information is then utilized to identify relevant matches with other people who have specified matched values in their dating preferences. On Dating, religious views are subject to purpose limitation requirements, for example, they will not be used to personalize experiences on other Facebook Products . We start with someone entering their religion information on their dating media profile using their mobile device, which is then transmitted to a web endpoint. The web endpoint subsequently logs the data into a logging table and stores it in a database, as depicted in the following code snippet: Now let’s see how we collect lineage signals. To do this, we need to employ both static and runtime analysis tools to effectively discover data flows, particularly focusing on where religion is logged and stored. By combining static and runtime analysis, we enhance our ability to accurately track and manage data flows. Static analysis tools simulate code execution to map out data flows within our systems. They also emit quality signals to indicate the confidence of whether a data flow signal is a true positive. However, these tools are limited by their lack of access to runtime data, which can lead to false positives from unexecuted code. To address this limitation, we utilize Privacy Probes , a key component of our PAI lineage technologies. Privacy Probes automate data flow discovery by collecting runtime signals. These signals are gathered in real time during the execution of requests, allowing us to trace the flow of data into loggers, databases, and other services. We have instrumented Meta’s core data frameworks and libraries at both the data origin points (sources) and their eventual outputs (sinks), such as logging framework, which allows for comprehensive data flow tracking. This approach is exemplified in the following code snippet: During runtime execution, Privacy Probes does the following: Capturing payloads : It captures source and sink payloads in memory on a sampled basis, along with supplementary metadata such as event timestamps, asset identifiers, and stack traces as evidence for the data flow. Comparing payloads : It then compares the source and sink payloads within a request to identify data matches, which helps in understanding how data flows through the system. Categorizing results : It categorizes results into two sets. The match-set includes pairs of source and sink assets where data matches exactly or one is contained by another, therefore providing high confidence evidence of data flow between the assets. The full-set includes all source and sink pairs within a request no matter whether the sink is tainted by the source. Full-set is a superset of match-set with some noise but still important to send to human reviewers since it may contain transformed data flows. The above procedure is depicted in the diagram below: Let’s look at the following examples where various religions are received in an endpoint and various values (copied or transformed) being logged in three different loggers: Input Value (source) Output Value (sink) Data Operation Match Result Flow Confidence “Atheist” “Atheist” Data Copy EXACT_MATCH HIGH “Buddhist” {metadata: {religion: Buddhist}} Substring CONTAINS HIGH {religions: [“Catholic”, “Christian”]} {count : 2} Transformed NO_MATCH LOW In the examples above, the first two rows show a precise match of religions in the source and the sink values, thus belonging to the high confidence match-set. The third row depicts a transformed data flow where the input string value is transformed to a count of values before being logged, belonging to full-set. These signals together are used to construct a lineage graph to understand the flow of data through our web system as shown in the following diagram: Collecting data flow signals for the data warehouse system With the user’s religion logged in our web system, it can propagate to the data warehouse for offline processing. To gather data flow signals, we employ a combination of both runtime instrumentation and static code analysis in a different way from the web system. The involved SQL queries are logged for data processing activities by the Presto and Spark compute engines (among others). Static analysis is then performed for the logged SQL queries and job configs in order to extract data flow signals. Let’s examine a simple SQL query example that processes data for the data warehouse as the following: We’ve developed a SQL analyzer to extract data flow signals between the input table, “safety_log_tbl” and the output table, “safety_training_tbl” as shown in the following diagram. In practice, we also collect more granular-level lineage such as at column-level (e.g., “user_id” -> “target_user_id”, “religion” -> “target_religion”). T here are instances where data is not fully processed by SQL queries, resulting in logs that contain data flow signals for either reads or writes, but not both. To ensure we have complete lineage data, we leverage contextual information (such as execution environments; job or trace IDs) collected at runtime to connect these reads and writes together. The following diagram illustrates how the lineage graph has expanded: Collecting data flow signals for the AI system For our AI systems, we collect lineage signals by tracking relationships between various assets, such as input datasets, features, models, workflows, and inferences. A common approach is to extract data flows from job configurations used for different AI activities such as model training. For instance, in order to improve the relevance of dating matches, we use an AI model to recommend potential matches based on shared religious views from users. Let’s take a look at the following training config example for this model that uses religion data: By parsing this config obtained from the model training service, we can track the data flow from the input dataset (with asset ID asset://hive.table/dating_training_tbl) and feature (with asset ID asset://ai.feature/DATING_USER_RELIGION_SCORE) to the model (with asset ID asset://ai.model/dating_ranking_model). Our AI systems are also instrumented so that asset relationships and data flow signals are captured at various points at runtime, including data-loading layers (e.g., DPP ) and libraries (e.g., PyTorch ), workflow engines (e.g., FBLearner Flow ), training frameworks, inference systems (as backend services), etc. Lineage collection for backend services utilizes the approach for function-based systems described above. By matching the source and sink assets for different data flow signals, we are able to capture a holistic lineage graph at the desired granularities: Identifying relevant data flows from a lineage graph Now that we have the lineage graph at our disposal, how can we effectively distill a subset of data flows pertinent to a specific privacy requirement for religion data? To address this question, we have developed an iterative analysis tool that enables developers to pinpoint precise data flows and systematically filter out irrelevant ones . The tool kicks off a repetitive discovery process aided by the lineage graph and privacy controls from Policy Zones, to narrow down the most relevant flows. This refined data allows developers to make a final determination about the flows they would like to use, producing an optimal path for traversing the lineage graph. The following are the major steps involved, captured holistically in the diagram, below: Discover data flows: identify data flows from source assets and stop at downstream assets with low-confidence flows (yellow nodes). Exclude and include candidates: Developers or automated heuristics exclude candidates (red nodes) that don’t have religion data or include remaining ones (green nodes). By excluding the red nodes early on, it helps to exclude all of their downstream in a cascaded manner, and thus saves developer efforts significantly. As an additional safeguard, developers also implement privacy controls via Policy Zones, so all relevant data flows can be captured. Repeat discovery cycle: use the green nodes as new sources and repeat the cycle until no more green nodes are confirmed. With the collection and data flow identification steps complete, developers are able to successfully locate granular data flows that contain religion across Meta’s complex systems, allowing them to move forward in the PAI workflow to apply necessary privacy controls to safeguard the data. This once-intimidating task has been completed efficiently. Our data lineage technology has provided developers with an unprecedented ability to quickly understand and protect religion and similar sensitive data flows. It enables Meta to scalably and efficiently implement privacy controls via PAI to protect our users’ privacy and deliver products safely. Learnings and challenges As we’ve worked to develop and implement lineage as a core PAI technology, we’ve gained valuable insights and overcome significant challenges, yielding some important lessons: Focus on lineage early and reap the rewards : As we developed privacy technologies like Policy Zones, it became clear that gaining a deep understanding of data flows across various systems is essential for scaling the implementation of privacy controls. By investing in lineage, we not only accelerated the adoption of Policy Zones but also uncovered new opportunities for applying the technology. Lineage can also be extended to other use cases such as security and integrity. Build lineage consumption tools to gain engineering efficiency : We initially focused on building a lineage solution but didn’t give sufficient attention to consumption tools for developers. As a result, owners had to use raw lineage signals to discover relevant data flows, which was overwhelmingly complex. We addressed this issue by developing the iterative tooling to guide engineers in discovering relevant data flows, significantly reducing engineering efforts by orders of magnitude. Integrate lineage with systems to scale the coverage : Collecting lineage from diverse Meta systems was a significant challenge. Initially, we tried to ask every system to collect lineage signals to ingest into the centralized lineage service, but the progress was slow. We overcame this by developing reliable, computationally efficient, and widely applicable PAI libraries with built-in lineage collection logic in various programming languages (Hack, C++, Python, etc.). This enabled much smoother integration with a broad range of Meta’s systems. Measurement improves our outcomes : By incorporating the measurement of coverage, we’ve been able to evolve our data lineage so that we stay ahead of the ever-changing landscape of data and code at Meta. By enhancing our signals and adapting to new technologies, we can maintain a strong focus on privacy outcomes and drive ongoing improvements in lineage coverage across our tech stacks. The future of data lineage Data lineage is a vital component of Meta’s PAI initiative, providing a comprehensive view of how data flows across different systems. While we’ve made significant progress in establishing a strong foundation, our journey is ongoing. We’re committed to: Expanding coverage : continuously enhance the coverage of our data lineage capabilities to ensure a comprehensive understanding of data flows. Improving consumption experience : streamline the consumption experience to make it easier for developers and stakeholders to access and utilize data lineage information. Exploring new frontiers : investigate new applications and use cases for data lineage, driving innovation and collaboration across the industry. By advancing data lineage, we aim to foster a culture of privacy awareness and drive progress in the broader fields of study. Together, we can create a more transparent and accountable data ecosystem. Acknowledgements The authors would like to acknowledge the contributions of many current and former Meta employees who have played a crucial role in developing data lineage technologies over the years. In particular, we would like to extend special thanks to (in alphabetical order) Amit Jain, Aygun Aydin, Ben Zhang, Brian Romanko, Brian Spanton, Daniel Ramagem, David Molnar, Dzmitry Charnahalau, Gayathri Aiyer, George Stasa, Guoqiang Jerry Chen, Graham Bleaney, Haiyang Han, Howard Cheng, Ian Carmichael, Ibrahim Mohamed, Jerry Pan, Jiang Wu, Jonathan Bergeron, Joanna Jiang, Jun Fang, Kiran Badam, Komal Mangtani, Kyle Huang, Maharshi Jha, Manuel Fahndrich, Marc Celani, Lei Zhang, Mark Vismonte, Perry Stoll, Pritesh Shah, Qi Zhou, Rajesh Nishtala, Rituraj Kirti, Seth Silverman, Shelton Jiang, Sushaant Mujoo, Vlad Fedorov, Yi Huang, Xinbo Gao, and Zhaohui Zhang. We would also like to express our gratitude to all reviewers of this post, including (in alphabetical order) Aleksandar Ilic, Avtar Brar, Benjamin Renard, Bogdan Shubravyi, Brianna O’Steen, Chris Wiltz, Daniel Chamberlain, Hannes Roth, Imogen Barnes, Jason Hendrickson, Koosh Orandi, Rituraj Kirti, and Xenia Habekoss. We would like to especially thank Jonathan Bergeron for overseeing the effort and providing all of the guidance and valuable feedback, Supriya Anand for leading the editorial effort to shape the blog content, and Katherine Bates for pulling all required support together to make this blog post happen.",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "design_patterns",
+      "security"
+    ]
   }
 ]


--- src/content/chunker.ts
diff --git a/src/content/chunker.ts b/src/content/chunker.ts
index 8a20926..65d23cb 100644
--- a/src/content/chunker.ts
+++ b/src/content/chunker.ts
@@ -13,13 +13,14 @@ const INDENTED_CODE_PATTERN = /(?:^(?:    |\t)[^\n]+\n?)+/gm;
  * Rules:
  * - Split by paragraphs first; accumulate until CHUNK_SIZE reached
  * - Start next chunk with CHUNK_OVERLAP tokens from end of previous
- * - Code blocks: never split mid-block — include the whole block in a chunk
- *   (if a code block > CHUNK_SIZE, it becomes its own standalone chunk)
+ * - Code blocks: keep them intact when reasonably sized
+ * - Oversized segments are subdivided before chunk assembly so no single
+ *   chunk can exceed the embedding model's practical input limit
  *
  * Returns an array of chunk strings.
  */
 export function chunkArticle(text: string): string[] {
-  const segments = extractSegments(text);
+  const segments = extractSegments(text).flatMap(splitOversizedSegment);
   const chunks: string[] = [];
   let current: string[] = [];
   let currentWords = 0;
@@ -27,17 +28,6 @@ export function chunkArticle(text: string): string[] {
   for (const segment of segments) {
     const segWords = countWords(segment);
 
-    // Oversized code block → standalone chunk
-    if (segWords > WORDS_PER_CHUNK && isCodeBlock(segment)) {
-      if (current.length > 0) {
-        chunks.push(current.join('\n\n'));
-        current = buildOverlap(current);
-        currentWords = countWords(current.join(' '));
-      }
-      chunks.push(segment.trim());
-      continue;
-    }
-
     // Would overflow current chunk → flush
     if (currentWords + segWords > WORDS_PER_CHUNK && current.length > 0) {
       chunks.push(current.join('\n\n'));
@@ -113,3 +103,80 @@ function countWords(text: string): number {
 function isCodeBlock(text: string): boolean {
   return text.startsWith('```') || /^(    |\t)/.test(text);
 }
+
+function splitOversizedSegment(segment: string): string[] {
+  const trimmed = segment.trim();
+  if (!trimmed) return [];
+
+  if (countWords(trimmed) <= WORDS_PER_CHUNK) {
+    return [trimmed];
+  }
+
+  return isCodeBlock(trimmed)
+    ? splitOversizedCodeBlock(trimmed)
+    : splitOversizedText(trimmed);
+}
+
+function splitOversizedText(text: string): string[] {
+  return splitWords(text, OVERLAP_WORDS);
+}
+
+function splitOversizedCodeBlock(block: string): string[] {
+  const lines = block.split('\n');
+  const firstLine = lines[0]?.trim() ?? '';
+  const lastLine = lines[lines.length - 1]?.trim() ?? '';
+  const isFenced = firstLine.startsWith('```') && lastLine === '```';
+
+  const bodyLines = isFenced ? lines.slice(1, -1) : lines;
+  const chunks = splitLines(bodyLines, Math.max(8, Math.floor(OVERLAP_WORDS / 4)));
+
+  if (!isFenced) {
+    return chunks;
+  }
+
+  return chunks.map((chunk) => `${firstLine}\n${chunk}\n\`\`\``);
+}
+
+function splitLines(lines: string[], overlapLines: number): string[] {
+  const chunks: string[] = [];
+  let current: string[] = [];
+  let currentWords = 0;
+
+  for (const line of lines) {
+    const lineWords = countWords(line);
+
+    if (currentWords + lineWords > WORDS_PER_CHUNK && current.length > 0) {
+      chunks.push(current.join('\n'));
+      current = current.slice(Math.max(0, current.length - overlapLines));
+      currentWords = countWords(current.join('\n'));
+    }
+
+    current.push(line);
+    currentWords += lineWords;
+  }
+
+  if (current.length > 0) {
+    chunks.push(current.join('\n'));
+  }
+
+  return chunks.flatMap((chunk) => splitOversizedText(chunk));
+}
+
+function splitWords(text: string, overlapWords: number): string[] {
+  const words = text.split(/\s+/).filter((word) => word.length > 0);
+  if (words.length <= WORDS_PER_CHUNK) {
+    return [text.trim()];
+  }
+
+  const chunks: string[] = [];
+  let start = 0;
+
+  while (start < words.length) {
+    const end = Math.min(words.length, start + WORDS_PER_CHUNK);
+    chunks.push(words.slice(start, end).join(' '));
+    if (end >= words.length) break;
+    start = Math.max(end - overlapWords, start + 1);
+  }
+
+  return chunks;
+}

```

### Commit 4: a884538
**Message:** docs: add specs and remaining content-intelligence changes

**Diff:**
```diff
--- AGENTS.md
diff --git a/CLAUDE.md b/AGENTS.md
similarity index 100%
rename from CLAUDE.md
rename to AGENTS.md


--- Frame 1.png
diff --git a/Frame 1.png b/Frame 1.png
new file mode 100644
index 0000000..58d0096
Binary files /dev/null and b/Frame 1.png differ


--- deuda tecnica.md
diff --git a/deuda tecnica.md b/deuda tecnica.md
new file mode 100644
index 0000000..41b40d4
--- /dev/null
+++ b/deuda tecnica.md	
@@ -0,0 +1,7 @@
+Summary of the 3+1 problems:
+
+Problem	Impact	Difficulty
+Modules too narrow — no "general engineering" detection	System produces ~0 posts	Medium (new module + lower thresholds)
+events_state not in Supabase	Wasted API calls every run	Easy (2 methods in SupabaseStorage)
+No in-memory SHA dedup	Same commit enriched N times per run	Easy (add a Set<string>)
+Voice not converging	Drafts don't sound like you	Medium (verify voice examples flow, token budget, bootstrap storage)
\ No newline at end of file


--- docs/adr/ADR-001-buffer-publishing-layer.md
diff --git a/docs/adr/ADR-001-buffer-publishing-layer.md b/docs/adr/ADR-001-buffer-publishing-layer.md
new file mode 100644
index 0000000..c32bbbb
--- /dev/null
+++ b/docs/adr/ADR-001-buffer-publishing-layer.md
@@ -0,0 +1,52 @@
+# ADR-001 — Buffer as the publishing layer
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-07 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+devcast generates social media posts from commit analysis. Those posts need to reach LinkedIn,
+Instagram, Twitter/X, Facebook, and potentially others. The alternatives were:
+
+1. **Direct integration per platform** — OAuth + posting API for each network separately.
+2. **Buffer as a publishing intermediary** — devcast sends draft Ideas to Buffer; the developer
+   reviews and publishes from Buffer's native UI.
+
+Additional constraint: LinkedIn's API requires app review before `w_member_social` scope is
+granted. Direct LinkedIn posting cannot be done without that approval.
+
+## Decision
+
+Use Buffer as the single publishing layer. devcast creates Ideas (drafts) in Buffer via
+the GraphQL API. The developer reviews from Buffer's UI and publishes to any connected
+network.
+
+Buffer free tier supports 3 channels (LinkedIn, Instagram, and one more). This covers the
+primary use case without cost.
+
+**Direct platform integrations are out of scope for the current phase.**
+`src/linkedin/client.ts` exists in the codebase from an earlier prototype but is not called
+in the production pipeline.
+
+## Consequences
+
+**Better:**
+- One integration (Buffer) covers all social networks devcast will ever need.
+- The developer retains full editorial control — devcast never auto-publishes.
+- No separate OAuth flows to maintain per platform in the short term.
+- Reduces maintenance surface: Buffer handles scheduling, formatting, and platform-specific
+  rendering rules.
+
+**Worse:**
+- Buffer free tier limits: 3 channels, 10 queued posts per channel. At scale this becomes
+  a paid plan dependency.
+- Buffer doesn't support third-party OAuth for API keys — users paste the key at onboarding.
+  This is a worse UX than OAuth and requires the key to be stored securely.
+- Buffer's API (GraphQL at `api.buffer.com`) is the published API; the older REST
+  (`api.bufferapp.com/1`) is deprecated and returns 500s. This means all Buffer operations
+  must use GraphQL.
+- devcast cannot fetch platform-level analytics (reactions, impressions) through Buffer —
+  requires a separate direct platform integration per network. See ADR-009.


--- docs/adr/ADR-002-envelope-encryption-kms.md
diff --git a/docs/adr/ADR-002-envelope-encryption-kms.md b/docs/adr/ADR-002-envelope-encryption-kms.md
new file mode 100644
index 0000000..00ebec2
--- /dev/null
+++ b/docs/adr/ADR-002-envelope-encryption-kms.md
@@ -0,0 +1,64 @@
+# ADR-002 — Envelope encryption with GCP KMS for token storage
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-08 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+devcast stores third-party API tokens (`buffer_access_token`) in the `tenants` table in
+Supabase. Storing tokens in plaintext is acceptable for alpha but not before accepting
+paying users or listing on GitHub Marketplace.
+
+Two options were considered:
+
+**Option A: Envelope encryption with GCP KMS**
+- One KMS key (the KEK — Key Encryption Key) covers all tenants.
+- At tenant creation: generate a random 256-bit DEK (Data Encryption Key) locally,
+  call KMS to encrypt the DEK, store the encrypted DEK in `tenants.encrypted_dek`.
+- Encrypt the token with the DEK before writing to DB. Stored as ciphertext in
+  `tenants.buffer_access_token`.
+- In the worker: call KMS once per job to unwrap the DEK, then decrypt the token locally.
+
+**Option B: GCP Secret Manager per token**
+- Each token stored as a separate Secret Manager secret.
+- `tenants.buffer_access_token` stores the secret resource name, not the value.
+- Worker calls Secret Manager to retrieve the token.
+
+## Decision
+
+**Envelope encryption with GCP KMS (Option A).**
+
+**Cost:**
+- Option A: 1 KMS key = ~$0.06/month fixed. KMS operations: ~$0.00 at alpha scale
+  (one unwrap per job run, billed per 10,000 operations at $0.03).
+- Option B: $0.06/secret/month × 1 token × N tenants = $0.06N/month.
+  At 100 tenants: $6/month just for storage + $0.03/10k accesses.
+  Option B scales linearly with tenants. Rejected.
+
+**Implementation scope:** The columns (`buffer_access_token`, `encrypted_dek`) stay as-is
+in the DB contract. Only the storage adapter and a decryption step in `processJob` change.
+`TenantRow` interface in `process-job.ts` is unchanged.
+
+**Not yet implemented.** Required before paid tier launch.
+
+## Consequences
+
+**Better:**
+- Fixed cost regardless of tenant count.
+- The master key (KEK) is never in the application code or DB — only in KMS.
+- A compromised DB gives an attacker encrypted DEKs and encrypted tokens, neither useful
+  without the KMS key.
+- KMS key rotation is independent of tenant data migration.
+
+**Worse:**
+- One additional KMS call per worker job (decrypt DEK). Adds ~20ms latency per job run.
+  Acceptable.
+- Self-managed encryption logic: the `encryptToken` and `decryptToken` helpers must be
+  implemented correctly. An error leaves tokens unreadable.
+- If the KMS key is deleted, all tenant tokens are permanently unrecoverable. Requires
+  a key deletion policy (30-day scheduled deletion minimum in GCP KMS).
+- `encrypted_dek` is a new column in `tenants` — requires a migration that also
+  re-encrypts any existing plaintext tokens during rollout.


--- docs/adr/ADR-003-article-extractor-library.md
diff --git a/docs/adr/ADR-003-article-extractor-library.md b/docs/adr/ADR-003-article-extractor-library.md
new file mode 100644
index 0000000..b1a7708
--- /dev/null
+++ b/docs/adr/ADR-003-article-extractor-library.md
@@ -0,0 +1,54 @@
+# ADR-003 — @extractus/article-extractor for article text extraction
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-07 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+The content intelligence pipeline needs to extract full article text from blog URLs. RSS
+feeds often contain partial text or summaries. The extractor must run in Node.js (the
+project stack) without requiring a separate runtime.
+
+Candidates evaluated:
+
+| Library | Reason rejected |
+|---------|----------------|
+| `readability` (Mozilla) | DOM-only; requires `jsdom` in Node.js — heavy (~5MB), slower, adds a DOM emulation layer |
+| `mercury-parser` (Postlight) | Archived in 2023, no maintenance |
+| `trafilatura` | Python-only; incompatible with Node.js stack without a subprocess call |
+| `@extractus/article-extractor` | Pure Node.js, actively maintained, MIT license, ~50KB |
+
+A feasibility spike was run on 30 curated URLs (April 2026):
+- URL extraction alone: 33% pass rate
+- RSS `content:encoded` alone: 63% raw pass rate
+- 3-layer strategy (RSS → URL → Puppeteer for curated): ~93% projected pass rate
+
+The acceptance gate was ≥ 80%.
+
+## Decision
+
+Use `@extractus/article-extractor` as the URL extraction layer in a 3-layer strategy:
+
+1. RSS `content:encoded` ≥ 300 words → use directly.
+2. Else: `article-extractor` on the URL.
+3. Else (curated sources only): Puppeteer fallback.
+
+This meets the ≥ 80% extraction gate. Do not regress to a 1-layer approach.
+
+## Consequences
+
+**Better:**
+- No external runtime dependency.
+- Actively maintained library with broad site support.
+- 3-layer strategy handles the majority of failure cases.
+
+**Worse:**
+- ~10–15% of articles still fail extraction (JS-rendered content, paywalls, anti-bot).
+  These are logged and skipped — not retried until next cycle.
+- Puppeteer is only used for curated sources to avoid cost and complexity at scale.
+  A high-value open-source blog that is JS-rendered will be skipped.
+- Extraction failures are explicitly NOT source quality failures — they do not
+  affect `content_sources.fetch_failures` or the source lifecycle.


--- docs/adr/ADR-004-pgvector-hnsw-parameters.md
diff --git a/docs/adr/ADR-004-pgvector-hnsw-parameters.md b/docs/adr/ADR-004-pgvector-hnsw-parameters.md
new file mode 100644
index 0000000..87d30b6
--- /dev/null
+++ b/docs/adr/ADR-004-pgvector-hnsw-parameters.md
@@ -0,0 +1,49 @@
+# ADR-004 — pgvector HNSW index parameters
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-07 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+The `article_chunks` table stores 1536-dimensional embeddings (OpenAI text-embedding-3-small)
+and requires an approximate nearest-neighbor index for cosine similarity search at query time.
+
+pgvector supports two index types: IVFFlat and HNSW. HNSW was chosen because it:
+- Supports incremental inserts without rebuild (IVFFlat requires pre-built lists)
+- Has better query-time recall at equivalent `ef_search` settings
+- Is the recommended index for pgvector since v0.5.0
+
+HNSW has two construction parameters:
+- `m`: number of bi-directional links per node. Higher = better recall, larger index size.
+- `ef_construction`: size of the dynamic candidate list during construction. Higher = better
+  recall, slower index build.
+
+## Decision
+
+Use HNSW with `m=16, ef_construction=64` — the pgvector defaults.
+
+At alpha corpus size (~3,000 chunks/year = ~250 chunks/week × 12 weeks), the index is
+trivially small. Any reasonable parameter set produces near-perfect recall at this scale.
+
+**Scaling path:**
+- Under 10,000 chunks: current parameters are fine.
+- At 10,000–50,000 chunks: if spot-checks show match recall below 80%, upgrade to
+  `m=32, ef_construction=128`.
+- HNSW parameter changes require `REINDEX` (seconds at 3,000 chunks, minutes at 50,000).
+
+**No action needed until the corpus exceeds 10,000 chunks or match recall drops below 80%.**
+
+## Consequences
+
+**Better:**
+- No upfront tuning cost.
+- pgvector defaults are well-tested and safe.
+- Incremental inserts work without rebuild.
+
+**Worse:**
+- At large scale, `m=16` can produce suboptimal recall for 1536-dim vectors. This is
+  a known limitation, documented with a clear trigger for when to revisit.
+- Changing parameters at scale requires a maintenance window for `REINDEX`.


--- docs/adr/ADR-005-openai-embeddings.md
diff --git a/docs/adr/ADR-005-openai-embeddings.md b/docs/adr/ADR-005-openai-embeddings.md
new file mode 100644
index 0000000..3b7db5e
--- /dev/null
+++ b/docs/adr/ADR-005-openai-embeddings.md
@@ -0,0 +1,56 @@
+# ADR-005 — OpenAI text-embedding-3-small for chunk embeddings
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-07 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+The content pipeline needs to embed article chunks (512-token text) and query embeddings
+(~100-token finding descriptions) for cosine similarity matching. The embedding model
+determines vector dimensions, cost, and quality.
+
+Requirements:
+- Compatible with Anthropic-first stack (but embedding is a separate concern — no Anthropic
+  embedding model exists for production use at this cost range)
+- Batch API support (50% cost reduction for weekly pipeline)
+- Low cost per token — weekly pipeline embeds ~250 chunks, query-time embeds ~1–3 per commit
+
+Candidates:
+
+| Model | Dims | Batch cost/MTok | Notes |
+|-------|------|-----------------|-------|
+| `text-embedding-3-small` | 1536 | $0.01 | Best cost/quality for semantic retrieval |
+| `text-embedding-3-large` | 3072 | $0.065 | 6.5× more expensive, marginal quality gain at this scale |
+| `text-embedding-ada-002` | 1536 | $0.05 | Legacy, superseded by 3-small |
+
+## Decision
+
+Use OpenAI `text-embedding-3-small` with 1536 dimensions.
+
+Cost at steady state: ~$0.001/week for batch pipeline (250 chunks × 512 tokens × $0.01/MTok).
+Query-time cost: ~$0.00007/commit (1 embedding × ~100 tokens × $0.02/MTok real-time).
+
+The `IEmbedder` interface (`src/ai/types.ts`) makes the provider swappable. Switching to
+a different provider requires: a new adapter implementing `IEmbedder`, a schema migration
+to change `vector(1536)` to the new dimension, and a full re-embed of all stored chunks.
+
+**Re-embed cost if switching:** ~$0.06 for 3,000 chunks at any reasonable provider price.
+Rare event; accepted.
+
+## Consequences
+
+**Better:**
+- Lowest cost at this scale with acceptable recall.
+- Batch API available (50% discount for weekly pipeline).
+- 1536 dims is supported natively by pgvector's HNSW index.
+
+**Worse:**
+- Introduces a second AI provider (OpenAI) alongside Anthropic. Two API keys, two cost
+  centers, two failure modes.
+- `vector(1536)` is hardcoded in the schema. Changing embedding providers requires a
+  migration if the new provider uses different dimensions.
+- OpenAI embedding failures in the query-time path cause matching to be skipped entirely
+  for that commit. Post generates without industry context (graceful degradation).


--- docs/adr/ADR-006-anthropic-batch-api-classification.md
diff --git a/docs/adr/ADR-006-anthropic-batch-api-classification.md b/docs/adr/ADR-006-anthropic-batch-api-classification.md
new file mode 100644
index 0000000..9ab2f06
--- /dev/null
+++ b/docs/adr/ADR-006-anthropic-batch-api-classification.md
@@ -0,0 +1,58 @@
+# ADR-006 — Anthropic Batch API for article classification
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-07 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+The weekly content pipeline classifies ~120 articles per run using Claude Haiku. Each
+classification call takes ~100 input tokens (article text) + ~150 output tokens (JSON).
+
+Two execution modes:
+
+**Real-time (synchronous):** Call the Anthropic API once per article, wait for response,
+continue. Simple but ~6× more expensive and subject to rate limiting at 120 consecutive
+calls.
+
+**Batch API (asynchronous):** Submit all requests in one batch, poll for completion,
+download results. 50% cost reduction. SLA up to 24h but expected to complete in 5–15
+minutes for ~120 requests.
+
+The classification pipeline runs in a weekly GitHub Actions workflow (`content-fetch.yml`)
+which has a 6h timeout. Classification is not time-sensitive.
+
+## Decision
+
+Use the Anthropic Batch API for article classification. The 50% cost reduction at
+~120 requests/week is ~$0.16/week vs. ~$0.32/week.
+
+**Explicit exception to the `IAIClient` interface:** The Batch API's submit → poll →
+download lifecycle cannot be expressed through `IAIClient.complete()`. `classifier.ts`
+calls the Anthropic SDK directly. Switching the classifier to a different batch provider
+requires rewriting `classifier.ts`. This is accepted.
+
+**Cross-encoder and post generation remain provider-agnostic** via `IAIClient`.
+
+**Batch state persistence:** `content_pipeline_runs.classify_batch_id` stores the active
+batch ID so that if the workflow dies mid-run, the next run can check the in-flight batch
+rather than submitting a new one.
+
+**Timeout handling:** If the batch does not complete in 2h, the workflow exits. Next week's
+run checks for a pending `classify_batch_id` and resumes from the existing batch.
+
+## Consequences
+
+**Better:**
+- 50% cost reduction for the single largest AI expense in the pipeline.
+- Single API call to submit, no rate-limit management needed during classification.
+
+**Worse:**
+- `classifier.ts` is not provider-agnostic. Changing batch classification provider = rewrite.
+- Batch API introduces asynchronous state: the `classify_batch_id` must be persisted and
+  checked on each run. More complex than fire-and-forget.
+- Anthropic keeps batches for 29 days. OpenAI keeps them for 7 days. A batch that sits
+  unretrieved for more than 7 days (OpenAI) is permanently lost. Real probability: near zero
+  (weekly CRON runs every 7 days exactly).


--- docs/adr/ADR-007-article-quality-gate.md
diff --git a/docs/adr/ADR-007-article-quality-gate.md b/docs/adr/ADR-007-article-quality-gate.md
new file mode 100644
index 0000000..263bdb0
--- /dev/null
+++ b/docs/adr/ADR-007-article-quality-gate.md
@@ -0,0 +1,55 @@
+# ADR-007 — Article quality gate at score 6
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-07 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+The AI classifier scores articles 1–10 on technical depth and originality. The pipeline
+needs a threshold below which articles are discarded and not stored in `content_items`.
+
+The score distribution the classifier is calibrated to:
+- 1–3: tutorial, docs rehash, surface overview
+- 4–6: decent but not distinctive
+- 7–8: real-world experience, production insights
+- 9–10: exceptional depth — war stories, novel approaches with data
+
+Two candidate gates:
+- **Gate at 7:** Only store articles the classifier rates as "real-world experience or
+  better". Tighter corpus, lower noise.
+- **Gate at 6:** Accept articles that are "decent but not distinctive" if the classifier
+  says so. Higher recall, more noise.
+
+Constraint: LLM scoring is non-deterministic. The same article can score 6 or 7 on
+different runs. The classifier is the coarse filter; the cross-encoder (Stage 2 of
+matching) is the precision filter.
+
+## Decision
+
+**Gate at 6.**
+
+The classifier is a cost filter, not the quality arbiter. Discarding a score-6 article
+that would have been a valid match costs a post quality (false negative). Storing a
+score-6 article that doesn't match anything costs ~$0.003 in storage (false positive).
+
+The cross-encoder in the matching pipeline evaluates "strong" vs "weak" vs "none" for each
+candidate. A false positive from the classifier that reaches the cross-encoder will be
+filtered out at that stage.
+
+False negatives cannot be recovered. False positives are filtered downstream.
+
+## Consequences
+
+**Better:**
+- Higher recall: articles that the classifier underscores by 1 point are not lost.
+- Safe: the matching cross-encoder is the real quality gate that the developer's post
+  actually depends on.
+
+**Worse:**
+- ~10–20% more articles stored than a gate-7 policy would allow.
+- Slightly more pgvector storage and index size.
+- The `idx_voice_retrieval` and matching queries filter by `quality_score >= 6` — any
+  change to the gate requires updating both the storage code and the match query.


--- docs/adr/ADR-008-job-claim-semantics.md
diff --git a/docs/adr/ADR-008-job-claim-semantics.md b/docs/adr/ADR-008-job-claim-semantics.md
new file mode 100644
index 0000000..c33cfe0
--- /dev/null
+++ b/docs/adr/ADR-008-job-claim-semantics.md
@@ -0,0 +1,69 @@
+# ADR-008 — Job claim as two-step SELECT + conditional UPDATE
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-07 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+The `devcast-worker` Cloud Run Job runs every 15 minutes and must claim a pending job
+from `job_queue` without racing against other instances.
+
+The standard production-grade approach for queue claiming in PostgreSQL is:
+
+```sql
+SELECT id FROM job_queue
+  WHERE status = 'pending'
+  ORDER BY created_at ASC
+  LIMIT 1
+  FOR UPDATE SKIP LOCKED;
+```
+
+This atomically locks the row and prevents any concurrent worker from claiming the same job.
+However, this requires executing the SELECT and UPDATE in a single database transaction
+with row-level locking.
+
+The simpler alternative is a two-step approach:
+
+```sql
+-- Step 1: find candidate
+SELECT id FROM job_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;
+
+-- Step 2: conditional update (optimistic guard)
+UPDATE job_queue SET status = 'processing'
+  WHERE id = $jobId AND status = 'pending' RETURNING id;
+```
+
+If Step 2 returns empty (another worker claimed first), the caller returns null.
+
+## Decision
+
+**Two-step SELECT + conditional UPDATE** for the current phase.
+
+**Why this is safe today:** Cloud Run Job runs as a single instance per execution
+(Cloud Run Jobs do not run parallel instances by default). The race window between
+Step 1 and Step 2 is irrelevant when there is only one worker at a time.
+
+**When this breaks:** If Cloud Run Job is ever scaled to multiple parallel instances,
+or if a future reaper re-sets stuck `processing` jobs back to `pending`, two workers can
+claim the same job. At that point, replace with `FOR UPDATE SKIP LOCKED` in a single
+transaction via a stored procedure or a Supabase RPC.
+
+**Poison job gap:** A job stuck in `processing` forever (worker killed mid-run) is not
+detected. The `leased_until TIMESTAMPTZ` column is specified but not yet added. When added,
+the worker sets `leased_until = NOW() + 10min` at claim time, and a reaper query at worker
+startup resets any `processing` job where `leased_until < NOW()` back to `pending`.
+
+## Consequences
+
+**Better:**
+- Simpler implementation — no transaction management, no Supabase RPC needed.
+- Sufficient for single-instance workload.
+
+**Worse:**
+- Not safe for concurrent workers. If scaling is ever needed, this must be replaced.
+- Poison jobs accumulate silently until the `leased_until` mechanism is implemented.
+- No idempotency guard against duplicate webhook events (`idempotency_key` is specified
+  but not yet added as a UNIQUE constraint on `job_queue`).


--- docs/adr/ADR-009-platform-analytics-direct-api.md
diff --git a/docs/adr/ADR-009-platform-analytics-direct-api.md b/docs/adr/ADR-009-platform-analytics-direct-api.md
new file mode 100644
index 0000000..cd6df31
--- /dev/null
+++ b/docs/adr/ADR-009-platform-analytics-direct-api.md
@@ -0,0 +1,82 @@
+# ADR-009 — Platform analytics via direct API after Buffer publish
+
+| Field | Value |
+|-------|-------|
+| Status | Accepted |
+| Date | 2026-04-08 |
+| Deciders | Liliana Castellanos |
+
+## Context
+
+devcast publishes via Buffer (see ADR-001). Buffer Ideas have no reaction or impression
+analytics in the Buffer API — Buffer's value proposition is scheduling and distribution,
+not analytics.
+
+To compute `engagement_score` (`edit_ratio × 0.6 + norm(reactions_count) × 0.4`),
+`reactions_count` must be populated from somewhere. The options were:
+
+**Option A: No platform analytics.** Keep `reactions_count = 0` permanently. Use only
+`edit_ratio` as the quality signal. Simple, no additional integrations.
+
+**Option B: Direct platform API after Buffer publish.** After the user publishes from
+Buffer, the scanner extracts the platform post identifier (e.g., LinkedIn URN) from the
+Buffer sent feed. A separate analytics CRON then fetches reactions from the platform
+API directly and updates `reactions_count`.
+
+## Decision
+
+**Direct platform API (Option B),** starting with LinkedIn.
+
+The `edit_ratio` signal measures whether the developer edits the draft before publishing.
+The `reactions_count` signal measures whether the published post resonates with the audience.
+These are different and complementary signals. Using both produces a more accurate quality
+score for voice training.
+
+`edit_ratio` alone can mislead: a developer who publishes without editing but whose posts
+get no traction is not generating high-quality content — the voice loop should not
+reinforce that pattern.
+
+**Dependency: LinkedIn app approval.** The LinkedIn socialActions API requires `r_liteprofile`
+plus either `r_organization_social` or `w_member_social` scope, which requires LinkedIn
+app review. This is blocked until approval is granted.
+
+**Implementation flow (once approved):**
+
+```
+devcast-scanner (existing, every 2h):
+  → For each matched voice_post where linkedin_urn IS NULL:
+      → Extract linkedin_urn from Buffer sent feed response (service_update_id per channel)
+      → Update voice_posts.linkedin_urn
+
+devcast-analytics (new Cloud Run Job, every 24h):
+  → SELECT posts WHERE linkedin_urn IS NOT NULL
+      AND published_at > NOW() - INTERVAL '7 days'
+      AND (last_reactions_fetch_at IS NULL
+           OR last_reactions_fetch_at < NOW() - INTERVAL '24 hours')
+  → GET LinkedIn socialActions API for each URN
+  → Update reactions_count, recompute engagement_score, set last_reactions_fetch_at
+```
+
+**Why 7-day window:** LinkedIn engagement concentrates in the first 72h. Fetching beyond
+7 days wastes API quota with diminishing returns.
+
+**Option A remains viable as a fallback** if LinkedIn app approval is denied or delayed
+significantly. `engagement_score` would be redefined as `edit_ratio` alone (remove the
+reactions term) and `reactions_count` and `linkedin_urn` would be dropped from the schema.
+
+## Consequences
+
+**Better:**
+- `engagement_score` uses actual audience signal, not just author editing behavior.
+- Voice training loop reinforces posts that both the developer liked (high edit_ratio)
+  and the audience engaged with (high reactions_count).
+
+**Worse:**
+- Blocked on LinkedIn app approval. Timeline unknown.
+- Adds a third Cloud Run Job (`devcast-analytics`) and a new LinkedIn API dependency.
+- `linkedin_urn` extraction depends on the Buffer sent feed exposing `service_update_id`
+  per channel. If Buffer changes their API response shape, the extraction breaks silently
+  (URN stays null, reactions never fetched, engagement_score stays null).
+- Not all platforms Buffer publishes to have equivalent analytics APIs. Instagram and
+  Twitter/X have progressively restricted their APIs. If the developer publishes to Instagram
+  only, `reactions_count` will remain 0 for that post indefinitely.


--- docs/adr/README.md
diff --git a/docs/adr/README.md b/docs/adr/README.md
new file mode 100644
index 0000000..b8c798f
--- /dev/null
+++ b/docs/adr/README.md
@@ -0,0 +1,35 @@
+# Architecture Decision Records
+
+This directory contains Architecture Decision Records (ADRs) for devcast.
+
+An ADR captures the context, decision, and consequences of a significant architectural
+choice. ADRs are immutable after acceptance — they are not updated when decisions change.
+A superseding decision creates a new ADR that references the old one.
+
+## Format
+
+Each ADR uses the following structure:
+
+| Field | Value |
+|-------|-------|
+| Status | `Accepted` / `Superseded by ADR-NNN` / `Deprecated` |
+| Date | YYYY-MM-DD |
+| Deciders | Who made the call |
+
+- **Context** — Why did this decision need to be made? What forces are at play?
+- **Decision** — What was decided and why this option over the alternatives?
+- **Consequences** — What does this decision make easier? What does it make harder?
+
+## Index
+
+| ADR | Title | Status |
+|-----|-------|--------|
+| [ADR-001](ADR-001-buffer-publishing-layer.md) | Buffer as the publishing layer | Accepted |
+| [ADR-002](ADR-002-envelope-encryption-kms.md) | Envelope encryption with GCP KMS for token storage | Accepted |
+| [ADR-003](ADR-003-article-extractor-library.md) | @extractus/article-extractor for article text extraction | Accepted |
+| [ADR-004](ADR-004-pgvector-hnsw-parameters.md) | pgvector HNSW index parameters | Accepted |
+| [ADR-005](ADR-005-openai-embeddings.md) | OpenAI text-embedding-3-small for chunk embeddings | Accepted |
+| [ADR-006](ADR-006-anthropic-batch-api-classification.md) | Anthropic Batch API for article classification | Accepted |
+| [ADR-007](ADR-007-article-quality-gate.md) | Article quality gate at score 6 | Accepted |
+| [ADR-008](ADR-008-job-claim-semantics.md) | Job claim as two-step SELECT + conditional UPDATE | Accepted |
+| [ADR-009](ADR-009-platform-analytics-direct-api.md) | Platform analytics via direct API after Buffer publish | Accepted |


--- docs/devcast-spec.md
diff --git a/docs/devcast-spec.md b/docs/devcast-spec.md
new file mode 100644
index 0000000..c227b89
--- /dev/null
+++ b/docs/devcast-spec.md
@@ -0,0 +1,3400 @@
+# devcast — Master Spec
+
+| Field | Value |
+|-------|-------|
+| Version | 1.5.17 |
+| Status | Phase 1: complete · Phase 2: implemented on feat/content-intelligence, pending merge + SQL migration · Phase 3: design only |
+| Last updated | 2026-04-08 |
+| Owner | Liliana Castellanos / Vialabs Spa |
+| App URL | https://app.devcast.lilicurl.com |
+
+---
+
+## Changelog
+
+| Version | Date | Changes |
+|---------|------|---------|
+| 1.5.17 | 2026-04-08 | `hashtags_kept_ratio` now documents its hashtag extraction regex, curated seed corpus module coverage is now persisted in `content_items.seed_modules`, and the `avoid` rebound rule includes an explicit alpha-calibration note. |
+| 1.5.16 | 2026-04-08 | `top_module_id` is now defined explicitly: it is taken from the first finding in the final pipeline ordering (`adjustedScore DESC`, then `interestScore DESC`, then `moduleId ASC` as deterministic tie-breakers), so prompt diversification no longer depends on incidental array order. |
+| 1.5.15 | 2026-04-08 | The scanner now defines how it enumerates authors per tenant: recent `voice_posts` activity plus explicit per-author `voice_profiles` rows, excluding historical ghost authors and the tenant-default null profile row. |
+| 1.5.14 | 2026-04-08 | `filterByContentStrategy()` now documents the minimal `EnrichedCommit` shape it consumes, so `matchesSkipPattern()` no longer relies on an implied commit schema from `commit-enricher.ts`. |
+| 1.5.13 | 2026-04-08 | `getVoiceProfile()` now has an explicit `IVoiceStorage` contract: it performs only the DB lookup chain (author-specific, then tenant default), returns `{ voice, version } | null`, lives in `src/voice/storage.ts`, and leaves `DEFAULT_VOICE_PROFILE` fallback to the caller. |
+| 1.5.12 | 2026-04-08 | `expired` verification is now explicitly batched by Buffer profile: `sent-scanner.ts` reuses the profile sent-feed sync for both published matching and stale-draft checks, paginates by profile when needed, and never performs one Buffer request per stale draft. |
+| 1.5.11 | 2026-04-08 | `industry_context_removed` now has a short-anchor guardrail: if normalized `match_connection` has fewer than 6 tokens, the scanner sets it to `false` and logs `voice.edit_analysis.context_anchor_too_short` instead of treating a tiny overlap as a context deletion. |
+| 1.5.10 | 2026-04-08 | The weekly content pipeline now defines `top 3/source` unambiguously: `source` means `content_sources.id`, and the cap is applied after structural scoring but before classifier batch assembly with explicit pseudocode. |
+| 1.5.9 | 2026-04-08 | Phase 2 corpus math is now explicit: the Article Funnel is documented as weekly throughput, while the Cold Start timeline separately models protected seed chunks plus 45-day cleanup, fixing the old Week 4 / Month 3 inconsistency. |
+| 1.5.8 | 2026-04-08 | `industry_context_preference='avoid'` no longer traps the system: `voice_posts.context_status` now distinguishes `skipped` vs `no_match` vs `matched`, Loop 4 excludes skipped rows from preference learning, and `process-job.ts` forces a periodic probe attempt so `avoid` can rebound to `neutral`. |
+| 1.5.7 | 2026-04-08 | Phase 2 now explicitly states that `matchFindingsToArticles()` returns structured `IndustryMatch` metadata, while `process-job.ts` persists `has_industry_context`, `matched_article_id`, `matched_source_id`, `match_strength`, and `match_connection` on the draft row at generation time. |
+| 1.5.6 | 2026-04-08 | `matchFindingsToArticles()` now defines its optional `MatcherOptions` contract in Phase 2 with `stage1Threshold` defaulting to `0.75`; Phase 3 only consumes that existing contract instead of introducing a new signature. |
+| 1.5.5 | 2026-04-08 | Loop 1 extractor refresh now uses the same quality gates as `voice_history`: `getRecentPublished()` excludes rewrites and low-edit-ratio posts, refresh skips when fewer than 5 strong samples remain, and the old "weak examples for extractor refresh" wording was removed. |
+| 1.5.4 | 2026-04-08 | Final consistency fixes: behavioral `<preferences>` now override conflicting extracted hook devices, `TenantConfig` keys are documented, `edit_analysis` added to Phase 3 prerequisites, short hooks/closings skip overlap-based change analysis, and source reactivation ownership is assigned to `discover-sources.yml`. |
+| 1.5.3 | 2026-04-08 | Cross-phase inconsistency fixes: `author_login` is now marked required for Phase 3, `last_reactions_fetch_at` added to schema/migrations, freshness multiplier storage/caching defined, `expired` requires a Buffer verification step before marking false negatives, `industry_context_preference` thresholds specified, prompt-builder replacement called out explicitly, and impossible source reactivation / CLT-only daily cap rules corrected. |
+| 1.5.2 | 2026-04-08 | Voice extractor split into `style_patterns` + `voice_devices` instead of a single `extracted_patterns` field. `discouraged_hook_styles` now uses a defined enum, scanner loop order is specified end-to-end, and V1 explicitly excludes per-post confidence scoring and selection explainability UI. |
+| 1.5.1 | 2026-04-08 | Phase 3 ambiguity fixes after v1.5.0 review: `skip_patterns` scope defined, `computeEditRatio()` contract documented, `edit_analysis` algorithms specified, `industry_context_removed` made detectable via stored `match_connection`, `content_preferences` now has explicit consumers, and audience is documented as manual-only. |
+| 1.5.0 | 2026-04-08 | Phase 3 rewritten into one canonical section. Voice system now specifies `voice_history` selection, `ContentStrategy`, `edit_analysis`, negative feedback via `expired`, structured extractor input, corrected hashtag `always` wording, and proper optimistic locking with top-level `version`. Onboarding now captures both voice and content strategy. |
+| 1.4.0 | 2026-04-08 | Buffer-only publishing (LinkedIn direct removed from current phase scope). Status convention legend added. voice_posts table reorganized by concern, engagement_score formula fixed, state machine completed. Tenants table: linkedin_access_token removed, envelope encryption frozen as token storage strategy. content_sources: is_protected column added. Seed corpus: recency vs 45-day expiry interaction documented. Voice extractor: extracted_at no longer described as optimistic lock. Editing artifacts fixed throughout. |
+| 1.3.0 | 2026-04-08 | Implementation Status section: verified deployed vs branch vs gaps vs not started. Schema gaps migration script. `top_module_id` gap identified (written by code, missing from schema.sql). `has_industry_context` gap (logged but never persisted). Analytics columns not written anywhere. slot-manager confirmed not wired. |
+| 1.2.0 | 2026-04-08 | Daily cap scoped per (tenant_id, authorLogin). Migration plan with pre-flight checks + rollback. Batch API `batch_id` persistence in `content_pipeline_runs`. HNSW parameters justified with scaling path. Source reactivation requires quality gate. Jaccard dedup limitation documented. IAIClient section right-sized. `/settings/voice` UI spec for org installs. Open Questions section (OQ-1 through OQ-7). Cold start corpus (200 pre-curated articles) as launch prerequisite. |
+| 1.1.0 | 2026-04-07 | Full DB schema contract. Security risk section (token encryption). Worker semantics (lease, poison jobs, idempotency). Analytics flags (has_industry_context). Voice rule layers separated. Costs complete (infra + AI). Hashtag contradiction fixed. AI agnosticism exception documented. Optimistic lock fixed (version field). Tenant health status section. |
+| 1.0.0 | 2026-04-07 | Unified spec: Phase 1 + Phase 2 + Phase 3 (Voice Profile). Consolidated from phase1-spec.md, content-intelligence-spec.md, voice-profile-spec.md |
+
+---
+
+## Status Conventions
+
+Every section, column, and feature in this document uses one of four labels:
+
+| Label | Meaning |
+|-------|---------|
+| **[CURRENT STATE]** | Deployed on `trunk` and running in production. |
+| **[REQUIRED BEFORE LAUNCH]** | Must be done before accepting paying users. Not yet implemented. |
+| **[SPECIFIED BUT NOT IMPLEMENTED]** | Designed here, but no code or schema column exists yet. |
+| **[OPEN DECISION]** | Requires a product or architectural decision before implementation can start. |
+
+---
+
+## Mission
+
+Most developers build things the world never sees.
+Not because the work isn't worth seeing — but because explaining it takes time and energy
+that most developers don't have after shipping. devcast fixes that.
+
+Every time a developer pushes code, devcast reads the commit, understands what's
+interesting about it, and writes a social media post in that developer's own voice.
+No templates. No generic summaries. Real posts, in real voices, about real engineering work.
+
+**The work deserves to be seen. devcast makes that happen automatically.**
+
+---
+
+## Who is this for
+
+Three profiles, all valid:
+
+**1. The solo developer or startup engineer**
+Commits frequently. Has things worth saying. Has zero time to say them. Wants
+LinkedIn/social presence without the overhead of writing posts. devcast runs silently
+in the background and surfaces their best work.
+
+**2. The company with a dev team on GitHub**
+Marketing wants developer content. Developers don't want to write it. devcast gives
+each developer their own voice (not a corporate template) while the company pays for it —
+because their engineering blog is now automatic, per-developer, and authentic.
+
+**3. The non-developer who came back to programming via AI**
+Vibe coders, PMs who now ship, designers who learned to code. They're building real things
+but don't have the vocabulary to explain it. devcast does the translation for them.
+
+---
+
+## What devcast does
+
+devcast is a GitHub Marketplace App that monitors repositories for new commits, runs the
+code through 24 specialized analysis modules, translates findings into social media posts
+using Claude AI, and sends them to Buffer as Ideas for review and publishing.
+
+Each developer gets posts in their own voice. Industry context from curated engineering
+blogs is injected when relevant. The system improves automatically as the developer
+publishes and edits posts.
+
+**Publishing:** Buffer is the publishing layer — it supports LinkedIn, Instagram, Twitter/X,
+Facebook, Mastodon, and more. devcast sends Ideas (drafts) to Buffer; the developer reviews
+and publishes from Buffer's native UI. This gives the developer full control and access to
+all social networks without devcast needing to integrate each one.
+
+> **This phase is Buffer-only.** LinkedIn direct posting (`src/linkedin/client.ts`) exists
+> in the codebase but is out of scope for the current launch. All publishing flows through Buffer.
+
+**Source control:** GitHub today. Bitbucket, GitLab, and others in a future phase.
+
+**Model:** `claude-sonnet-4-6` for post generation. `claude-haiku-4-5` for classify/cross-encode/voice-extract.
+
+---
+
+## Architecture Overview
+
+### Three Cloud Run services (same Docker image, different entry points)
+
+```
+getdevcast-webhook  (Cloud Run Service — always on, scales to zero)
+  → GitHub webhooks (push, installation events)
+  → Onboarding UI at /onboard
+  → OAuth callbacks (GitHub)
+  → Enqueues jobs in job_queue table
+
+devcast-worker  (Cloud Run Job — every 15 min via Cloud Scheduler)
+  → Claims pending jobs from job_queue
+  → Per job: fetch tenant → installation token → process commits
+  → Pipeline: enrich → filter → analyze → match → generate → post
+
+devcast-scanner  (Cloud Run Job — every 2h via Cloud Scheduler)
+  → Iterates all active tenants with Buffer tokens
+  → Scans published Buffer posts → edit_ratio → voice training loop
+  → [Phase 3] Refreshes voice profiles per author after 5 new published posts
+```
+
+### CI/CD
+
+Push to `trunk` → GitHub Actions → Docker build → deploys all three services.
+Workload Identity Federation (no long-lived GCP keys in GitHub).
+
+---
+
+## Commit Pipeline (per push)
+

--- docs/oldspecs/commit2social-prompts-final-v2.md
diff --git a/commit2social-prompts-final-v2.md b/docs/oldspecs/commit2social-prompts-final-v2.md
similarity index 100%
rename from commit2social-prompts-final-v2.md
rename to docs/oldspecs/commit2social-prompts-final-v2.md


--- docs/oldspecs/content-generator-v2.md
diff --git a/content-generator-v2.md b/docs/oldspecs/content-generator-v2.md
similarity index 100%
rename from content-generator-v2.md
rename to docs/oldspecs/content-generator-v2.md


--- docs/oldspecs/content-intelligence-spec.md
diff --git a/docs/oldspecs/content-intelligence-spec.md b/docs/oldspecs/content-intelligence-spec.md
new file mode 100644
index 0000000..9d8ecbd
--- /dev/null
+++ b/docs/oldspecs/content-intelligence-spec.md
@@ -0,0 +1,931 @@
+# Phase 2 — Content Intelligence Agent — Design Spec
+
+**Status:** Draft v10 — reviewed 2026-04-06
+
+---
+
+## Goal
+
+When devcast generates a post about a user's commit, connect it with what the industry is discussing. If a user builds a circuit breaker and Netflix just published about their circuit breaker failures — the post becomes 10x more relevant.
+
+Fallback: if no match found, generate a normal code analysis post (current behavior, always available).
+
+---
+
+## Prerequisite: AI Agnosticism
+
+All LLM and embedding interactions go through interfaces. No SDK imported outside of adapter files.
+
+```typescript
+// src/ai/types.ts
+export interface IAIClient {
+  complete(systemPrompt: string, userPrompt: string): Promise<string>;
+  readonly model: string;
+}
+
+export interface IEmbedder {
+  embed(text: string): Promise<number[]>;
+  readonly dimensions: number;
+}
+```
+
+```typescript
+// src/ai/factory.ts
+export function createAIClient(provider: string, apiKey: string, model: string, maxTokens: number): IAIClient;
+export function createEmbedder(provider: string, apiKey: string): IEmbedder;
+```
+
+V1 implementations: `AnthropicAdapter` + `OpenAIEmbedder`. Swappable without touching pipeline code.
+
+Config:
+```yaml
+ai:
+  provider: "anthropic"
+  model: "claude-sonnet-4-6"
+  max_tokens: 1600
+  classify_model: "claude-haiku-4-5"   # cheaper model for classification + cross-encoding
+embeddings:
+  provider: "openai"
+  model: "text-embedding-3-small"
+```
+
+### New secrets required
+
+| Secret | Purpose | Where |
+|--------|---------|-------|
+| `OPENAI_API_KEY` | Embedding articles and findings | GitHub Actions + Cloud Run |
+
+`ANTHROPIC_API_KEY` already exists — used for both Sonnet (post generation) and Haiku (classification + cross-encoding).
+
+### Batch API usage (50% discount on both providers)
+
+Both Anthropic and OpenAI offer Batch APIs with 50% discount for async processing. The weekly CRON is not time-sensitive — results can wait up to 24 hours.
+
+| Provider | Regular | Batch (50% off) | Used for |
+|----------|---------|-----------------|----------|
+| Anthropic Haiku input | $1.00/MTok | $0.50/MTok | Classifier, cross-encoder |
+| Anthropic Haiku output | $5.00/MTok | $2.50/MTok | Classifier, cross-encoder |
+| OpenAI text-embedding-3-small | $0.02/MTok | $0.01/MTok | Article chunk embeddings |
+
+The classifier and embedder in the weekly CRON submit work via Batch API. The cross-encoder in the per-commit pipeline runs in real-time (not batched) since it needs immediate results for post generation.
+
+---
+
+## Architecture Overview
+
+```
+[CRON monthly — discover-sources.yml]
+Reference repos (OPML) → RSS auto-discovery → add in batches of 20/week
+
+[CRON weekly — content-fetch.yml]
+Promote 20 queued sources → active
+Fetch RSS from active sources
+  → extract full article text (@extractus/article-extractor)
+  → dedup (exact title hash + fuzzy similarity)
+  → pre-skip (changelogs, release notes, < 300 words)
+  → structural score (free, all articles)
+  → top 3 per source (best by structural score)
+  → AI classify (IAIClient, Haiku Batch API)
+  → chunk (recursive 512-token)
+  → embed chunks (IEmbedder, OpenAI Batch API)
+  → store in Supabase (pgvector)
+  → update source stats + log summary
+
+[In post-generation pipeline — per commit]
+Finding → pgvector match → AI cross-encoder → inject if strong match
+  → update matched_count on source + times_matched on article
+```
+
+---
+
+## Layer 1 — Source Registry
+
+### Discovery
+
+Two community-maintained GitHub repos serve as market intelligence:
+- `tuan3w/awesome-tech-rss` (~180 sources, includes RSS URLs, OPML file)
+- `kilimchoi/engineering-blogs` (~400 sources, homepage URLs + OPML file)
+
+These repos are NOT the feed. They are input for discovering new sources. The system's own registry decides what to fetch based on measured performance.
+
+New sources from repos are added in batches of 20/week, prioritizing sources that appear in BOTH repos first.
+
+### RSS Auto-Discovery
+
+`kilimchoi/engineering-blogs` lists homepage URLs, not RSS URLs. Before adding a source, the system must find the RSS feed:
+
+```typescript
+// src/content/rss-discovery.ts
+export async function discoverRssUrl(homepageUrl: string): Promise<string | null> {
+  // 1. Fetch homepage HTML
+  // 2. Parse <link rel="alternate" type="application/rss+xml" href="...">
+  // 3. Also check <link rel="alternate" type="application/atom+xml" href="...">
+  // 4. Fallback: try common paths (/feed, /rss, /atom.xml, /feed.xml, /index.xml)
+  // 5. If nothing found → return null (source not added)
+}
+```
+
+Sources without a discoverable RSS feed are logged and skipped — not added to the registry.
+
+### Source Schema
+
+```sql
+CREATE TABLE content_sources (
+  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  name                TEXT NOT NULL,
+  url                 TEXT NOT NULL UNIQUE,
+  rss_url             TEXT NOT NULL,
+  trust               TEXT NOT NULL DEFAULT 'open',   -- 'curated' | 'verified' | 'open'
+  status              TEXT NOT NULL DEFAULT 'queued',   -- 'queued' | 'active' | 'probation' | 'disabled' | 'unreachable'
+  -- quality stats
+  articles_evaluated  INTEGER NOT NULL DEFAULT 0,
+  articles_passed     INTEGER NOT NULL DEFAULT 0,
+  best_score_30d      INTEGER NOT NULL DEFAULT 0,
+  -- value stats (the metric that actually matters)

--- docs/oldspecs/content-strategy.json
diff --git a/content-strategy.json b/docs/oldspecs/content-strategy.json
similarity index 100%
rename from content-strategy.json
rename to docs/oldspecs/content-strategy.json


--- docs/oldspecs/phase1-spec.md
diff --git a/docs/oldspecs/phase1-spec.md b/docs/oldspecs/phase1-spec.md
new file mode 100644
index 0000000..ca86551
--- /dev/null
+++ b/docs/oldspecs/phase1-spec.md
@@ -0,0 +1,572 @@
+# Phase 1 — GitHub Marketplace — Spec & Gap Analysis
+
+**Status:** v6 FINAL — 2026-04-06
+
+---
+
+## Goal
+
+devcast as a one-click installable GitHub App. Any developer installs it, configures in 2 minutes, and starts receiving LinkedIn posts from their commits. Multi-tenant from day one.
+
+---
+
+## Architectural Transition: Single-Tenant → Multi-Tenant
+
+devcast was built as a single-tenant system for Liliana. Multi-tenant (GitHub App) was added on top. The storage layer was never updated. This creates data contamination between tenants.
+
+### Before (single-tenant, how it worked for Liliana)
+
+```
+[GitHub Actions CRONs — Liliana's credentials hardcoded]
+
+poll-and-generate.yml (every 4h)
+  → main-poll.ts
+  → config from config.yaml (Liliana's github_username)
+  → credentials from GitHub Actions secrets (Liliana's tokens)
+  → SupabaseStorage(url, key) — no tenant, queries all rows
+  → voice_posts written without tenant_id
+
+scan-sent-posts.yml (every 2h)
+  → main-scan.ts
+  → Liliana's BUFFER_ACCESS_TOKEN from secrets
+  → scans Liliana's Buffer account
+  → matches against ALL voice_posts (no tenant filter)
+```
+
+### After (multi-tenant, how it should work)
+
+```
+[Webhook + Cloud Run — per-tenant credentials from DB]
+
+GitHub push → webhook → job_queue(tenant_id)
+  → devcast-worker (every 15 min)
+  → process-job.ts
+  → tenant from DB (credentials, config)
+  → SupabaseStorage(url, key, tenant.id) — tenant-scoped
+  → voice_posts written WITH tenant_id
+
+devcast-scanner (every 2h)
+  → main-scan-tenants.ts
+  → for each tenant with buffer_access_token
+  → scan THEIR Buffer account with THEIR token
+  → match against voice_posts WHERE tenant_id = tenant.id
+```
+
+### The gap: storage layer is still single-tenant
+
+The worker (`process-job.ts`) knows the tenant. The storage (`SupabaseStorage`) doesn't. All voice_posts are written and queried without tenant scope. Two tenants using devcast today would contaminate each other's voice training.
+
+### Migration plan for Liliana's data
+
+Liliana's existing voice_posts were created by the single-tenant path (no tenant_id). These must be assigned to her tenant before the multi-tenant storage goes live:
+
+1. **Verify**: `SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL` — should match Liliana's post count
+2. **Backfill**: `UPDATE voice_posts SET tenant_id = (SELECT id FROM tenants WHERE github_username = 'lilicurl') WHERE tenant_id IS NULL`
+3. **Verify again**: `SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL` — should be 0
+
+After this, the single-tenant crons are disabled (kept as `workflow_dispatch` for local dev), and all processing goes through the multi-tenant worker + scanner.
+
+`main-poll.ts` and `main-scan.ts` remain in the codebase as local dev tools. For local dev, they use `SqliteStorage` which also gets tenant support, using `TENANT_ID` env var (or a default value for single-user local testing).
+
+### Cutover sequence (exact order of operations)
+
+The transition from single-tenant to multi-tenant has a timing risk: between deploy (new code with `WHERE tenant_id = X`) and backfill (existing rows get tenant_id), queries return 0 results. The worker runs every 15 minutes — that's the window.
+
+**Strategy: deploy + backfill in the same 15-minute window, before the next worker run.**
+
+```
+1. Merge PR A to trunk
+   → CI/CD deploys webhook + worker automatically (~3 min)
+
+2. IMMEDIATELY run backfill in Supabase SQL Editor (within 15 min of deploy):
+   -- Verify
+   SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL;
+   
+   -- Backfill
+   UPDATE voice_posts SET tenant_id = (
+     SELECT id FROM tenants WHERE github_username = 'lilicurl'
+   ) WHERE tenant_id IS NULL;
+   
+   -- Verify again
+   SELECT COUNT(*) FROM voice_posts WHERE tenant_id IS NULL;
+   -- Must be 0
+
+3. Verify: push a test commit → worker processes it → voice_posts row has tenant_id
+
+4. Merge PR B (disable single-tenant CRONs + multi-tenant scanner)
+   → CI/CD deploys
+
+5. Create Cloud Run Job + Cloud Scheduler for scanner:
+   gcloud run jobs create devcast-scanner --image gcr.io/lilicurl/devcast:latest \
+     --region us-central1 --project lilicurl \
+     --command "npx" --args "tsx,src/worker/main-scan-tenants.ts" \
+     --update-secrets=...
+   
+   gcloud scheduler jobs create http devcast-scanner-trigger \
+     --schedule "0 */2 * * *" \
+     --uri "https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/749111652662/jobs/devcast-scanner:run" \
+     --http-method POST \
+     --oauth-service-account-email 749111652662-compute@developer.gserviceaccount.com \
+     --location us-central1 --project lilicurl
+
+6. Verify: publish a post from Buffer → scanner picks it up → voice_posts.status = 'published'
+
+7. Done. Single-tenant path disabled. Multi-tenant path active.
+```
+
+### Backward compatibility during the window
+
+The tenant-scoped queries MUST handle `tenant_id IS NULL` gracefully during the backfill window. If a query finds 0 rows with `WHERE tenant_id = ?`, the pipeline continues without voice examples (same behavior as a new tenant with no history). No crash, no data loss — just lower quality posts for ~15 minutes until backfill completes.
+
+This is NOT a code change — it's an operational acceptance. The code uses strict `WHERE tenant_id = $1` (no fallback to NULL). If backfill is delayed, Liliana's posts during the window generate without voice examples. Acceptable for a one-time migration.
+
+---
+
+## Current State (what's implemented)
+
+### Infrastructure
+
+| Component | Status | Where |
+|-----------|--------|-------|
+| GitHub App (`getdevcast`) | Registered, transferred to vialabs-net | github.com/settings/apps |
+| Webhook receiver | Cloud Run Service `getdevcast-webhook` | `src/webhook/server.ts` |
+| Worker | Cloud Run Job `devcast-worker`, every 15 min | `src/worker/main-worker.ts` |
+| CI/CD | GitHub Actions → Docker build → Cloud Run deploy | `.github/workflows/deploy.yml` |
+| Custom domain | `app.devcast.lilicurl.com` → Cloud Run | GCP domain mapping |
+| Favicon | `public/favicon.png` served from server.ts | `src/webhook/server.ts` |
+
+### Single-tenant workflows (pre-Marketplace, to be disabled)
+
+| Workflow | Status | Notes |
+|----------|--------|-------|
+| `poll-and-generate.yml` | **To disable** | Single-tenant CRON every 4h. Replaced by webhook + worker. |
+| `scan-sent-posts.yml` | **To disable** | Single-tenant CRON every 2h. Replaced by multi-tenant scanner. |
+

--- docs/oldspecs/voice-profile-spec.md
diff --git a/docs/oldspecs/voice-profile-spec.md b/docs/oldspecs/voice-profile-spec.md
new file mode 100644
index 0000000..8a09be1
--- /dev/null
+++ b/docs/oldspecs/voice-profile-spec.md
@@ -0,0 +1,537 @@
+# Voice Profile System — Spec
+
+Status: design / pending implementation approval
+Branch target: `feat/voice-profile`
+
+---
+
+## Problem
+
+The current `prompt-builder.ts` has Liliana's personal voice hardcoded. For GitHub
+Marketplace, each individual developer needs their own voice — even when the app is
+installed on an organization. One org installation does not mean one voice. Five developers
+pushing commits must produce five distinct voices.
+
+---
+
+## Scope
+
+**In scope:**
+- Per-developer voice profile (`voice_profiles` table, keyed by `github_author_login`)
+- 3-tier degradation: examples → tone picker → baseline
+- Voice extractor (Haiku, runs on bootstrap save + periodic refresh from published posts)
+- Post structure varies with tone — injected for all tiers
+- Human-readable voice summary for UI (always in sync with extracted_patterns)
+- Universal `<never>` rules for all users
+- Configurable post length
+- Hashtags as preference by default; opt-in to force
+
+**Out of scope (explicit):**
+- Org-level voice restrictions or shared templates
+- Voice inheritance (org default → member override)
+- Per-repository voice profiles
+
+---
+
+## Architecture: Individual Voice, Always
+
+Every commit author gets their own voice profile. The app install (tenant) is a billing and
+access unit — not a voice unit.
+
+**Lookup chain in `process-job.ts`:**
+```
+1. voice_profiles WHERE tenant_id = X AND github_author_login = commit.authorLogin
+2. voice_profiles WHERE tenant_id = X AND github_author_login IS NULL  (tenant default)
+3. DEFAULT_VOICE_PROFILE
+```
+
+**Who creates profiles:**
+- **Individual install**: onboarding creates one profile for `tenant.github_username`.
+- **Org install**: onboarding creates one profile for the installing user. Other org members
+  configure their own at `/settings/voice` (future UI, same extractor logic, same schema).
+- Until a member configures their own, they fall through to step 2 or 3 above.
+
+`authorLogin` already exists in `EnrichedCommit` (`src/github/commit-enricher.ts:10`).
+No changes needed to commit enrichment.
+
+---
+
+## Data Model
+
+### New table: `voice_profiles`
+
+```sql
+CREATE TABLE IF NOT EXISTS voice_profiles (
+  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  tenant_id            UUID NOT NULL REFERENCES tenants(id),
+  github_author_login  TEXT,                         -- NULL = tenant default
+  voice                JSONB NOT NULL DEFAULT '{}',
+  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+-- One default profile per tenant (github_author_login IS NULL)
+CREATE UNIQUE INDEX idx_voice_profiles_tenant_default
+  ON voice_profiles(tenant_id)
+  WHERE github_author_login IS NULL;
+
+-- One profile per author per tenant
+CREATE UNIQUE INDEX idx_voice_profiles_tenant_author
+  ON voice_profiles(tenant_id, github_author_login)
+  WHERE github_author_login IS NOT NULL;
+```
+
+`tenants.config.voice` is deprecated. Existing data migrates to `voice_profiles` with
+`github_author_login = tenant.github_username` on first access (lazy migration in
+`getVoiceProfile`, not a one-time migration script).
+
+`tenants.voice_bootstrap` (TEXT column, from Phase 1) is **not touched**. It stays in
+`tenants` as the raw text the user pasted. The extractor reads it as input but never
+modifies it. What the extractor produces (`extracted_patterns`, `voice_summary`) is stored
+in `voice_profiles.voice`, not back in `tenants`.
+
+### `VoiceProfile` interface (stored in `voice_profiles.voice` JSONB)
+
+```typescript
+interface VoiceProfile {
+  // Tier 2 — tone picker
+  tone: 'formal' | 'professional' | 'casual' | 'humorous' | 'storytelling' | 'teaching';
+  rhythm: 'paragraphs' | 'mixed' | 'short-sentences';
+
+  // Preferences
+  hashtags: string[];
+  hashtags_mode: 'always' | 'prefer';    // 'prefer' = use when relevant, Claude may override
+  post_length: { min: number; max: number };
+
+  // Tier 1 — generated by extractor
+  extracted_patterns?: string;    // ≤ 600 chars, prompt-ready writing instructions
+  voice_summary?: string;         // ≤ 200 chars, human-readable for UI
+
+  // Extractor metadata
+  extraction_source?: 'bootstrap' | 'published_posts';
+  extracted_at?: string;          // ISO timestamp; also acts as optimistic lock
+}
+```
+
+**Why 600 chars (up from 400):** `storytelling` and `teaching` need richer pattern
+descriptions to maintain quality. Simple tones (professional, casual) use far less.
+
+**Zod:**
+```typescript
+const VoiceProfileSchema = z.object({
+  tone: z.enum(['formal', 'professional', 'casual', 'humorous', 'storytelling', 'teaching'])
+    .default('professional'),
+  rhythm: z.enum(['paragraphs', 'mixed', 'short-sentences']).default('mixed'),
+  hashtags: z.array(z.string().max(50)).max(10).default([]),
+  hashtags_mode: z.enum(['always', 'prefer']).default('prefer'),
+  post_length: z.object({
+    min: z.number().int().min(300).max(2999),
+    max: z.number().int().min(301).max(3000),
+  }).refine((v) => v.min < v.max, { message: 'min must be less than max' })
+    .default({ min: 1200, max: 1800 }),
+  extracted_patterns: z.string().max(600).optional(),
+  voice_summary: z.string().max(200).optional(),
+  extraction_source: z.enum(['bootstrap', 'published_posts']).optional(),
+  extracted_at: z.string().optional(),
+});
+
+export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
+  tone: 'professional',
+  rhythm: 'mixed',
+  hashtags: [],
+  hashtags_mode: 'prefer',
+  post_length: { min: 1200, max: 1800 },
+};

--- docs/seed-corpus-spec.md
diff --git a/docs/seed-corpus-spec.md b/docs/seed-corpus-spec.md
new file mode 100644
index 0000000..dc23525
--- /dev/null
+++ b/docs/seed-corpus-spec.md
@@ -0,0 +1,734 @@
+# devcast — Seed Corpus Spec
+
+| Field | Value |
+|-------|-------|
+| Version | 1.0.0 |
+| Status | Design — not yet executed |
+| Owner | Liliana Castellanos / Vialabs Spa |
+| Parent spec | `devcast-spec.md` v1.5.16 — Cold Start Corpus section |
+| Mode | Hybrid: AI proposes candidates, human approves |
+
+---
+
+## Purpose
+
+Produce the 200-article seed corpus that devcast Phase 2 requires before accepting users. Without this corpus, the first three months of installs see zero industry context matches, and the entire Content Intelligence Agent looks dead from the user's perspective.
+
+This spec covers everything from "blank spreadsheet" to "verified rows in `content_items` and `article_chunks`". It does not duplicate the master spec — it implements the operational steps the master spec only sketches at a high level.
+
+---
+
+## Authoritative references (do not redefine)
+
+These come from `devcast-spec.md` and must be respected exactly. If anything in this document conflicts with them, the master spec wins.
+
+| Item | Source |
+|------|--------|
+| `content_items` schema | master spec, line 549 |
+| `article_chunks` schema | master spec, line 575 |
+| `content_sources` schema with `is_protected` | master spec, line 509 |
+| Chunking strategy (512 tokens, 64 overlap, never split code) | master spec, line 1363 |
+| 3-layer extraction strategy | master spec, line 1188 |
+| Article quality criteria (war stories, metrics, tradeoffs) | master spec, structural scoring section |
+| 24 analysis modules list | master spec, line 714 |
+| Cold Start Corpus rationale and `week_of='2026-01-01'` convention | master spec, line 1590 |
+| `is_protected=TRUE` exemption from cleanup CRON | master spec, line 1638 |
+
+---
+
+## Out of scope
+
+- Modifying Phase 2 schema beyond the one optional `seed_modules` column proposed below
+- Changes to cleanup CRON logic (already specified in master spec as a [REQUIRED BEFORE LAUNCH] item)
+- Continuous refresh of the seed corpus (this is one-time; future phases can revisit)
+- Tagging real-time RSS-fetched articles with modules (out of scope; only seed articles are tagged)
+
+---
+
+## Deliverables
+
+1. `seed-articles.json` — the curated and verified list of 200 articles, with full text extracted
+2. `scripts/seed-corpus/` — a small directory with the helper scripts described below
+3. One `content_sources` row with `name='curated-seed'`, `is_protected=TRUE`
+4. ~200 rows in `content_items` and ~1000 rows in `article_chunks`, all referencing the seed source
+5. A coverage report proving every one of the 24 analysis modules has at least 3 seed articles tagged
+
+---
+
+## Optional schema addition
+
+The master spec notes (issue B in the v1.5.16 review) that `content_items` has no column to store which modules a seed article was tagged for. Two options:
+
+**Option 1 — add a column (recommended).**
+
+```sql
+ALTER TABLE content_items
+  ADD COLUMN IF NOT EXISTS seed_modules TEXT[] DEFAULT NULL;
+```
+
+- `NULL` for all RSS-fetched articles
+- An array of module ids for seed articles
+- Enables a SQL coverage audit at any time:
+  ```sql
+  SELECT module, COUNT(*)
+  FROM content_items, unnest(seed_modules) AS module
+  WHERE source_id = (SELECT id FROM content_sources WHERE name='curated-seed')
+  GROUP BY module
+  ORDER BY COUNT(*) ASC;
+  ```
+- Enables future analytics like "is this match coming from seed or fresh content?"
+
+**Option 2 — keep tags only in `seed-articles.json`, no DB column.**
+
+- Coverage audit lives only in the JSON file
+- After seeding completes, there is no way to answer the audit question from the DB alone
+- Acceptable if you commit to never deleting `seed-articles.json` from the repo
+
+This spec assumes Option 1. If you reject it, replace every `seed_modules` reference below with "verify against `seed-articles.json` instead".
+
+---
+
+## The 24 modules — coverage targets
+
+From the master spec (line 732). Each module must end with at least 3 articles tagged.
+
+| Category | Modules | Min articles |
+|---|---|---|
+| Architecture | `architecture_patterns`, `design_patterns`, `evolutionary` | 3 each = 9 |
+| Quality | `clean_code`, `testing`, `error_resilience`, `complexity` | 3 each = 12 |
+| Platform | `performance`, `security`, `observability`, `devops`, `concurrency`, `dependency_health` | 3 each = 18 |
+| API & integration | `api_design`, `integration` | 3 each = 6 |
+| Type & DX | `type_system`, `dx`, `ai_assisted` | 3 each = 9 |
+| Languages & frameworks | `js_advanced`, `react_patterns`, `python`, `go`, `java_quarkus`, `elixir` | 3 each = 18 |
+
+**Hard floor: 72 articles to satisfy minimums.** That leaves ~128 articles to distribute on whichever modules attract more high-quality candidates. Architecture, performance, observability, and security tend to dominate; do not over-budget them at the expense of language-specific coverage.
+
+A single article can be tagged with multiple modules if it genuinely covers them (e.g. a Netflix Hystrix post tagged `error_resilience` + `architecture_patterns`). Multi-tagging counts toward each module's minimum.
+
+---
+
+## Workflow — three tracks in parallel
+
+### Track 1 — Known classics (target: ~60 articles, ~half a day)
+
+Articles you, your circle, or well-known engineering leaders already cite. No AI search needed. Open browser, navigate to the blogs you already trust, pick 2-3 per author/source.
+
+Reference list of high-yield sources by module (non-exhaustive):
+
+| Module | Sources to mine first |
+|---|---|
+| `architecture_patterns`, `design_patterns`, `evolutionary` | martinfowler.com, Sam Newman, ThoughtWorks Insights |
+| `performance`, `observability` | Netflix Tech Blog, Discord Engineering, Cloudflare Blog, Honeycomb |
+| `security` | Cloudflare Blog, GitHub Security Lab, Trail of Bits, Project Zero |
+| `api_design` | Stripe Blog, Slack Engineering, Shopify Engineering |
+| `error_resilience`, `concurrency` | Netflix (Hystrix-era posts), Uber Engineering, AWS Builders Library |
+| `react_patterns`, `js_advanced` | overreacted.io (Dan Abramov), kentcdodds.com, Josh Comeau |
+| `python` | Real Python, Hynek Schlawack, Łukasz Langa |
+| `go` | Dave Cheney, Bradfitz, Go Blog |
+| `elixir` | theerlangelist.com (Saša Jurić), Dashbit Blog, Plataformatec archives |
+| `java_quarkus` | Quarkus Blog, Red Hat Developers, InfoQ Java track |
+| `devops` | Honeycomb (Charity Majors), Bridget Kromhout, Increment magazine |
+| `testing` | Kent Beck, t-wada, Software Engineering at Google online chapters |
+| `ai_assisted` | Anthropic engineering posts, Simon Willison's blog, GitHub Next |
+
+**Output of Track 1:** rows added to the working spreadsheet (see below) with `source: track1` and `status: candidate`.
+
+### Track 2 — AI-assisted search (target: ~100 articles, 1-2 days)
+
+For modules that Track 1 did not cover well (especially language-specific ones), use Claude or another web-search-enabled assistant to propose candidates.
+
+**One query per module.** Do not ask one mega-query for all 24 modules at once — the IA will overweight the famous ones and leave gaps.
+
+**Query template:**
+
+```

--- manual.md
diff --git a/manual.md b/manual.md
new file mode 100644
index 0000000..a603339
--- /dev/null
+++ b/manual.md
@@ -0,0 +1,3 @@
+ara ver logs del worker en tiempo real si quieres confirmar que procesa jobs:
+gcloud run jobs executions list --job=devcast-worker \
+  --region=us-central1 --project=lilicurl --limit=5


--- seed-extraction-failures.json
diff --git a/seed-extraction-failures.json b/seed-extraction-failures.json
new file mode 100644
index 0000000..7739335
--- /dev/null
+++ b/seed-extraction-failures.json
@@ -0,0 +1,37 @@
+[
+  {
+    "id": "11",
+    "url": "https://www.linkedin.com/blog/engineering/generative-ai/behind-the-platform-the-journey-to-create-the-linkedin-genai-application-tech-stack",
+    "reason": "extractor_returned_null"
+  },
+  {
+    "id": "12",
+    "url": "https://www.uber.com/blog/from-static-rate-limiting-to-intelligent-load-management/",
+    "reason": "extractor_returned_null"
+  },
+  {
+    "id": "13",
+    "url": "https://www.uber.com/blog/how-uber-serves-over-150-million-reads/",
+    "reason": "extractor_returned_null"
+  },
+  {
+    "id": "14",
+    "url": "https://www.uber.com/blog/ureview/",
+    "reason": "extractor_returned_null"
+  },
+  {
+    "id": "15",
+    "url": "https://www.uber.com/blog/perfinsights/",
+    "reason": "extractor_returned_null"
+  },
+  {
+    "id": "26",
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/journey-of-next-generation-control-plane-for-data-systems",
+    "reason": "extractor_returned_null"
+  },
+  {
+    "id": "39",
+    "url": "https://www.uber.com/blog/automating-efficiency-of-go-programs-with-pgo/",
+    "reason": "extractor_returned_null"
+  }
+]


--- src/ai/prompt-builder.ts
diff --git a/src/ai/prompt-builder.ts b/src/ai/prompt-builder.ts
index 66d0341..d48ad93 100644
--- a/src/ai/prompt-builder.ts
+++ b/src/ai/prompt-builder.ts
@@ -66,10 +66,10 @@ DIRECT CLOSING: End with a short declarative. Never a question.
 </voice_devices>
 
 <structure>
-HOOK: One concrete fact. No preamble. No "Today I..." or "I'm excited to..."
-  "9,699 lines added. One line removed."
+HOOK: One concrete fact — a decision, a surprise, a tradeoff. No preamble. No "Today I..." or "I'm excited to..."
   "A type guard stopped a cascading client deactivation bug."
   "I shipped a module that finds performance bugs in code. Very exciting. Very useful."
+  "The retries were working. The idempotency key wasn't. Classic."
 
 CONTEXT: 2-3 short sentences. Project name, what was happening. No long explanations.
 
@@ -93,6 +93,10 @@ CLOSING: Direct statement. See DIRECT CLOSING device above.
 - Corporate buzzwords ("leverage", "synergy")
 - Emojis
 - Code blocks (they don't render on LinkedIn)
+- Lead with counts or quantities: not line counts, file counts, module counts, or commit sizes.
+  A reader should never think "okay, they changed 5 files." They should think "that's the decision I would have gotten wrong."
+  Lead with: the tradeoff that forced a decision, the consequence that surprised you, or the moment the architecture clicked.
+  Write like someone who learned something the hard way — not like someone filing a report.
 </never>
 
 <format>
@@ -136,7 +140,6 @@ export function buildUserPrompt(
   parts.push(`Repository: ${commit.repo}`);
   parts.push(`Message: ${commit.message}`);
   parts.push(`Languages: ${commit.languages.join(', ') || 'mixed'}`);
-  parts.push(`Changed: +${commit.totalAdditions} lines, -${commit.totalDeletions} lines`);
   parts.push('</commit>\n');
 
   // Module findings (natural language, not JSON)

```

### Commit 5: a9507ed
**Message:** feat: add seed corpus tooling and extraction hardening

**Diff:**
```diff
--- config.example.yaml
diff --git a/config.example.yaml b/config.example.yaml
index 7ecddd5..f050a21 100644
--- a/config.example.yaml
+++ b/config.example.yaml
@@ -38,6 +38,12 @@ ai:
   model: "claude-sonnet-4-6"
   max_tokens: 1600
 
+content:
+  extraction:
+    puppeteer_fallback_hosts:             # optional; can also use CONTENT_PUPPETEER_FALLBACK_HOSTS env var
+      - "discord.com"
+      - "stripe.com"
+
 # Optional: npm packages that extend devcast with custom analysis modules.
 # Each package must export a named `module` implementing CodeAnalyzer (devcast-sdk).
 # Install them first: npm install devcast-module-rust


--- database/migrations/2026-04-08-phase2-seed-readiness-verify.sql
diff --git a/database/migrations/2026-04-08-phase2-seed-readiness-verify.sql b/database/migrations/2026-04-08-phase2-seed-readiness-verify.sql
new file mode 100644
index 0000000..22add34
--- /dev/null
+++ b/database/migrations/2026-04-08-phase2-seed-readiness-verify.sql
@@ -0,0 +1,56 @@
+-- Post-migration verification for Phase 2 + seed corpus readiness
+
+-- 1. voice_posts match metadata columns exist
+SELECT column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND table_name = 'voice_posts'
+  AND column_name IN (
+    'top_module_id',
+    'edit_analysis',
+    'context_status',
+    'has_industry_context',
+    'matched_article_id',
+    'matched_source_id',
+    'match_strength',
+    'match_connection',
+    'last_reactions_fetch_at',
+    'publish_source',
+    'author_login'
+  )
+ORDER BY column_name;
+
+-- 2. content corpus support columns exist
+SELECT table_name, column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND (
+    (table_name = 'content_sources' AND column_name = 'is_protected')
+    OR
+    (table_name = 'content_items' AND column_name = 'seed_modules')
+  )
+ORDER BY table_name, column_name;
+
+-- 3. job_queue / pending_batch / pipeline-run gaps exist
+SELECT table_name, column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND (
+    (table_name = 'job_queue' AND column_name IN ('leased_until', 'idempotency_key'))
+    OR
+    (table_name = 'pending_batch' AND column_name IN ('tenant_id', 'author_login'))
+    OR
+    (table_name = 'content_pipeline_runs' AND column_name IN ('classify_batch_id', 'embed_batch_id'))
+    OR
+    (table_name = 'tenants' AND column_name = 'encrypted_dek')
+  )
+ORDER BY table_name, column_name;
+
+-- 4. unique partial index for idempotency_key exists
+SELECT indexname, indexdef
+FROM pg_indexes
+WHERE schemaname = 'public'
+  AND indexname = 'idx_job_queue_idempotency';
+
+-- 5. matcher function exists with protected-source clause
+SELECT pg_get_functiondef('match_article_chunks(vector,double precision,integer,integer,date)'::regprocedure);


--- database/migrations/2026-04-08-phase2-seed-readiness.sql
diff --git a/database/migrations/2026-04-08-phase2-seed-readiness.sql b/database/migrations/2026-04-08-phase2-seed-readiness.sql
new file mode 100644
index 0000000..6bc4493
--- /dev/null
+++ b/database/migrations/2026-04-08-phase2-seed-readiness.sql
@@ -0,0 +1,66 @@
+-- Phase 2 + seed corpus readiness migration
+-- Safe to run manually in Supabase SQL Editor.
+-- Idempotent: uses IF NOT EXISTS / CREATE OR REPLACE.
+
+-- voice_posts gaps
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis            JSONB;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context     BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id       UUID REFERENCES content_items(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id        UUID REFERENCES content_sources(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength           REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection         TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at  TIMESTAMPTZ;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;
+
+-- job_queue gaps
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until TIMESTAMPTZ;
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
+CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
+  ON job_queue(idempotency_key)
+  WHERE idempotency_key IS NOT NULL;
+
+-- content_pipeline_runs gaps
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS classify_batch_id TEXT;
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;
+
+-- pending_batch gaps
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS author_login TEXT;
+
+-- content_sources / content_items gaps for protected seed corpus support
+ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE content_items ADD COLUMN IF NOT EXISTS seed_modules TEXT[];
+
+-- tenants gaps
+ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek TEXT;
+
+-- matcher Stage 1 must include protected sources even if their week_of is backdated
+CREATE OR REPLACE FUNCTION match_article_chunks(
+  query_embedding      vector(1536),
+  similarity_threshold FLOAT,
+  match_count          INT,
+  min_quality_score    INT,
+  week_of_cutoff       DATE
+)
+RETURNS TABLE (content_item_id UUID, similarity FLOAT)
+LANGUAGE sql STABLE
+AS $$
+  SELECT
+    ac.content_item_id,
+    1 - (ac.embedding <=> query_embedding) AS similarity
+  FROM article_chunks ac
+  JOIN content_items ci ON ci.id = ac.content_item_id
+  LEFT JOIN content_sources cs ON cs.id = ci.source_id
+  WHERE
+    1 - (ac.embedding <=> query_embedding) >= similarity_threshold
+    AND ci.quality_score >= min_quality_score
+    AND (
+      ci.week_of >= week_of_cutoff
+      OR COALESCE(cs.is_protected, FALSE) = TRUE
+    )
+  ORDER BY ac.embedding <=> query_embedding
+  LIMIT match_count;
+$$;


--- database/schema.sql
diff --git a/database/schema.sql b/database/schema.sql
index ff6f9fd..ca27011 100644
--- a/database/schema.sql
+++ b/database/schema.sql
@@ -187,6 +187,36 @@ CREATE TABLE IF NOT EXISTS content_pipeline_runs (
   embed_failures        INTEGER NOT NULL DEFAULT 0
 );
 
+-- Schema gaps backfilled here so the full contract is available on both
+-- fresh installs and existing databases that were created before Phase 2 landed.
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis            JSONB;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context     BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id       UUID REFERENCES content_items(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id        UUID REFERENCES content_sources(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength           REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection         TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at  TIMESTAMPTZ;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;
+
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until               TIMESTAMPTZ;
+ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS idempotency_key            TEXT;
+CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
+  ON job_queue(idempotency_key)
+  WHERE idempotency_key IS NOT NULL;
+
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS classify_batch_id TEXT;
+ALTER TABLE content_pipeline_runs ADD COLUMN IF NOT EXISTS embed_batch_id    TEXT;
+
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS tenant_id    UUID REFERENCES tenants(id);
+ALTER TABLE pending_batch ADD COLUMN IF NOT EXISTS author_login TEXT;
+
+ALTER TABLE content_sources ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE content_items ADD COLUMN IF NOT EXISTS seed_modules   TEXT[];
+ALTER TABLE tenants ADD COLUMN IF NOT EXISTS encrypted_dek        TEXT;
+
 -- Indexes
 CREATE INDEX IF NOT EXISTS idx_title_hash ON content_items(title_hash);
 
@@ -214,10 +244,14 @@ AS $$
     1 - (ac.embedding <=> query_embedding) AS similarity
   FROM article_chunks ac
   JOIN content_items ci ON ci.id = ac.content_item_id
+  LEFT JOIN content_sources cs ON cs.id = ci.source_id
   WHERE
     1 - (ac.embedding <=> query_embedding) >= similarity_threshold
     AND ci.quality_score >= min_quality_score
-    AND ci.week_of >= week_of_cutoff
+    AND (
+      ci.week_of >= week_of_cutoff
+      OR COALESCE(cs.is_protected, FALSE) = TRUE
+    )
   ORDER BY ac.embedding <=> query_embedding
   LIMIT match_count;
 $$;


--- package.json
diff --git a/package.json b/package.json
index 771a1c7..6c0f04f 100644
--- a/package.json
+++ b/package.json
@@ -14,6 +14,9 @@
     "poll": "tsx --env-file=.env.local src/main-poll.ts",
     "scan": "tsx --env-file=.env.local src/main-scan.ts",
     "gen-image-prompt": "tsx --env-file=.env.local scripts/gen-image-prompt.ts",
+    "seed-corpus:extract": "tsx --env-file=.env.local scripts/seed-corpus/extract-text.ts",
+    "seed-corpus:validate": "tsx --env-file=.env.local scripts/seed-corpus/validate.ts",
+    "seed-corpus:seed": "tsx --env-file=.env.local scripts/seed-corpus/seed.ts",
     "test": "vitest run",
     "typecheck": "tsc --noEmit"
   },


--- scripts/seed-corpus/extract-text.ts
diff --git a/scripts/seed-corpus/extract-text.ts b/scripts/seed-corpus/extract-text.ts
new file mode 100644
index 0000000..a82de69
--- /dev/null
+++ b/scripts/seed-corpus/extract-text.ts
@@ -0,0 +1,110 @@
+/**
+ * Generate seed-articles.json from the frozen CSV by extracting full article text.
+ *
+ * Usage:
+ *   npm run seed-corpus:extract
+ *   npm run seed-corpus:extract -- --input path/to/seed-articles-frozen.csv --output path/to/seed-articles.json
+ */
+
+import { writeFileSync } from 'fs';
+import { extractArticle } from '../../src/content/article-extractor.js';
+import {
+  DEFAULT_FAILURES_JSON_PATH,
+  DEFAULT_FROZEN_CSV_PATH,
+  DEFAULT_SEED_JSON_PATH,
+  assertKnownModules,
+  getArgValue,
+  modulesFromRow,
+  parseInteger,
+  readFrozenCsv,
+  resolveCliPath,
+  type SeedArticle,
+  type SeedExtractionFailure,
+} from './shared.js';
+
+const MIN_WORD_COUNT = 300;
+const DEFAULT_DELAY_MS = 2_000;
+
+async function main(): Promise<void> {
+  const args = process.argv.slice(2);
+  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_FROZEN_CSV_PATH);
+  const outputPath = resolveCliPath(getArgValue(args, '--output'), DEFAULT_SEED_JSON_PATH);
+  const failuresPath = resolveCliPath(getArgValue(args, '--failures'), DEFAULT_FAILURES_JSON_PATH);
+  const delayMs = parseInteger(getArgValue(args, '--delay-ms') ?? String(DEFAULT_DELAY_MS), '--delay-ms');
+  const limit = getArgValue(args, '--limit');
+  const limitCount = limit ? parseInteger(limit, '--limit') : null;
+
+  const rows = readFrozenCsv(inputPath)
+    .filter((row) => row.status === 'kept' || row.status === 'text_extracted');
+  const selectedRows = limitCount === null ? rows : rows.slice(0, limitCount);
+
+  const out: SeedArticle[] = [];
+  const failures: SeedExtractionFailure[] = [];
+
+  console.log(`Extracting full text for ${selectedRows.length} curated rows from ${inputPath}`);
+
+  for (let index = 0; index < selectedRows.length; index++) {
+    const row = selectedRows[index]!;
+    const modules = modulesFromRow(row);
+    const qualityScore = parseInteger(row.quality_score, `quality_score for row ${row.id}`);
+
+    if (!row.url || !row.title || !row.source_name) {
+      throw new Error(`Row ${row.id} is missing url, title, or source_name`);
+    }
+    if (qualityScore < 7 || qualityScore > 10) {
+      throw new Error(`Row ${row.id} has invalid quality_score ${qualityScore}; expected 7-10`);
+    }
+    if (modules.length === 0) {
+      throw new Error(`Row ${row.id} has no module tags`);
+    }
+    assertKnownModules(modules, `row ${row.id}`);
+
+    process.stdout.write(`[${index + 1}/${selectedRows.length}] ${row.title} ... `);
+
+    try {
+      const article = await extractArticle(row.url, null, true);
+      if (!article) {
+        failures.push({ id: row.id, url: row.url, reason: 'extractor_returned_null' });
+        console.log('FAIL (extractor returned null)');
+      } else if (article.wordCount < MIN_WORD_COUNT) {
+        failures.push({ id: row.id, url: row.url, reason: `word_count_${article.wordCount}` });
+        console.log(`FAIL (${article.wordCount} words)`);
+      } else {
+        out.push({
+          url: row.url,
+          title: row.title,
+          source_name: row.source_name,
+          text: article.text,
+          quality_score: qualityScore,
+          modules,
+        });
+        console.log(`OK (${article.wordCount} words)`);
+      }
+    } catch (err) {
+      failures.push({ id: row.id, url: row.url, reason: String(err) });
+      console.log(`ERROR (${String(err).slice(0, 120)})`);
+    }
+
+    if (index < selectedRows.length - 1 && delayMs > 0) {
+      await sleep(delayMs);
+    }
+  }
+
+  writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`);
+  writeFileSync(failuresPath, `${JSON.stringify(failures, null, 2)}\n`);
+
+  console.log('');
+  console.log(`Extracted: ${out.length}/${selectedRows.length}`);
+  console.log(`Failures:  ${failures.length}`);
+  console.log(`JSON:      ${outputPath}`);
+  console.log(`Failures:  ${failuresPath}`);
+}
+
+function sleep(ms: number): Promise<void> {
+  return new Promise((resolve) => setTimeout(resolve, ms));
+}
+
+main().catch((err) => {
+  console.error('Seed extraction failed:', err);
+  process.exit(1);
+});


--- scripts/seed-corpus/seed.ts
diff --git a/scripts/seed-corpus/seed.ts b/scripts/seed-corpus/seed.ts
new file mode 100644
index 0000000..fcd1a1d
--- /dev/null
+++ b/scripts/seed-corpus/seed.ts
@@ -0,0 +1,226 @@
+/**
+ * Insert the curated seed corpus into Supabase and generate embeddings in real time.
+ *
+ * Usage:
+ *   npm run seed-corpus:seed
+ *   npm run seed-corpus:seed -- --input path/to/seed-articles.json --limit 10
+ */
+
+import Anthropic from '@anthropic-ai/sdk';
+import { createClient, type SupabaseClient } from '@supabase/supabase-js';
+import OpenAI from 'openai';
+import { articleFingerprint, titleHash } from '../../src/content/dedup.js';
+import { classifyArticleRealtimeWithClient } from '../../src/content/classifier.js';
+import { chunkArticle } from '../../src/content/chunker.js';
+import { storeArticle, storeChunks } from '../../src/content/content-storage.js';
+import {
+  DEFAULT_CLASSIFIER_MODEL,
+  DEFAULT_EMBEDDING_MODEL,
+  DEFAULT_SEED_JSON_PATH,
+  DEFAULT_SEED_SOURCE_NAME,
+  DEFAULT_SEED_WEEK_OF,
+  getArgValue,
+  loadSeedArticles,
+  parseInteger,
+  resolveCliPath,
+} from './shared.js';
+
+const SEED_SOURCE_URL = 'https://devcast.lilicurl.com/seed';
+const SEED_SOURCE_RSS_URL = 'https://devcast.lilicurl.com/seed.rss';
+
+async function main(): Promise<void> {
+  const args = process.argv.slice(2);
+  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_SEED_JSON_PATH);
+  const classifierModel = getArgValue(args, '--classifier-model') ?? DEFAULT_CLASSIFIER_MODEL;
+  const embeddingModel = getArgValue(args, '--embedding-model') ?? DEFAULT_EMBEDDING_MODEL;
+  const limitArg = getArgValue(args, '--limit');
+  const limit = limitArg ? parseInteger(limitArg, '--limit') : null;
+
+  const supabaseUrl = process.env['SUPABASE_URL'];
+  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
+  const openaiApiKey = process.env['OPENAI_API_KEY'];
+  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
+
+  if (!supabaseUrl || !supabaseKey || !openaiApiKey || !anthropicApiKey) {
+    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, and ANTHROPIC_API_KEY are required');
+  }
+
+  const articles = loadSeedArticles(inputPath);
+  const selectedArticles = limit === null ? articles : articles.slice(0, limit);
+  const db = createClient(supabaseUrl, supabaseKey);
+  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
+  const openai = new OpenAI({ apiKey: openaiApiKey });
+
+  const sourceId = await ensureSeedSource(db);
+
+  let inserted = 0;
+  let skipped = 0;
+  let failed = 0;
+
+  console.log(`Seeding ${selectedArticles.length} article(s) from ${inputPath}`);
+  console.log(`Seed source: ${DEFAULT_SEED_SOURCE_NAME} (${sourceId})`);
+
+  for (let index = 0; index < selectedArticles.length; index++) {
+    const article = selectedArticles[index]!;
+    process.stdout.write(`[${index + 1}/${selectedArticles.length}] ${article.title} ... `);
+
+    const { data: existing, error: existingError } = await db
+      .from('content_items')
+      .select('id')
+      .eq('url', article.url)
+      .maybeSingle();
+
+    if (existingError) {
+      throw new Error(`Failed to check existing article ${article.url}: ${existingError.message}`);
+    }
+
+    if (existing) {
+      skipped++;
+      console.log('SKIP (already exists)');
+      continue;
+    }
+
+    try {
+      const classification = await classifyArticleRealtimeWithClient(
+        { id: article.url, title: article.title, text: article.text },
+        anthropic,
+        classifierModel,
+      );
+
+      const contentItemId = await storeArticle(db, {
+        sourceId,
+        weekOf: DEFAULT_SEED_WEEK_OF,
+        url: article.url,
+        title: article.title,
+        contentText: article.text,
+        summary: classification.summary,
+        mainThesis: classification.main_thesis,
+        keyInsights: classification.key_insights,
+        techConcepts: classification.tech_concepts,
+        seedModules: article.modules,
+        qualityScore: article.quality_score,
+        titleHash: titleHash(article.title),
+        fingerprint: articleFingerprint(article.text),
+      });
+
+      if (!contentItemId) {
+        failed++;
+        console.log('FAIL (content_items insert failed)');
+        continue;
+      }
+
+      try {
+        const chunks = chunkArticle(article.text);
+        if (chunks.length === 0) {
+          throw new Error('Chunker returned 0 chunks');
+        }
+
+        const embeddingResponse = await openai.embeddings.create({
+          model: embeddingModel,
+          input: chunks,
+        });
+
+        if (embeddingResponse.data.length !== chunks.length) {
+          throw new Error(`Embedding count mismatch: expected ${chunks.length}, received ${embeddingResponse.data.length}`);
+        }
+
+        await storeChunks(
+          db,
+          chunks.map((chunkText, chunkIndex) => {
+            const embedding = embeddingResponse.data[chunkIndex]?.embedding;
+            if (!embedding) {
+              throw new Error(`Missing embedding for chunk ${chunkIndex}`);
+            }
+
+            return {
+              contentItemId,
+              chunkIndex,
+              chunkText,
+              embedding,
+            };
+          }),
+        );
+
+        inserted++;

--- scripts/seed-corpus/shared.ts
diff --git a/scripts/seed-corpus/shared.ts b/scripts/seed-corpus/shared.ts
new file mode 100644
index 0000000..af00804
--- /dev/null
+++ b/scripts/seed-corpus/shared.ts
@@ -0,0 +1,262 @@
+import { readFileSync } from 'fs';
+import { resolve } from 'path';
+import { MODULE_REGISTRY } from '../../src/analysis/modules/index.js';
+
+export const DEFAULT_FROZEN_CSV_PATH = 'seed-articles-frozen.csv';
+export const DEFAULT_SEED_JSON_PATH = 'seed-articles.json';
+export const DEFAULT_FAILURES_JSON_PATH = 'seed-extraction-failures.json';
+export const DEFAULT_SEED_SOURCE_NAME = 'curated-seed';
+export const DEFAULT_SEED_WEEK_OF = '2026-01-01';
+export const DEFAULT_CLASSIFIER_MODEL = 'claude-haiku-4-5';
+export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
+
+export interface FrozenCsvRow {
+  readonly id: string;
+  readonly track: string;
+  readonly module_primary: string;
+  readonly module_secondary: string;
+  readonly url: string;
+  readonly title: string;
+  readonly source_name: string;
+  readonly author: string;
+  readonly published_date: string;
+  readonly quality_score: string;
+  readonly why_kept: string;
+  readonly status: string;
+  readonly reject_reason: string;
+  readonly notes: string;
+}
+
+export interface SeedArticle {
+  readonly url: string;
+  readonly title: string;
+  readonly source_name: string;
+  readonly text: string;
+  readonly quality_score: number;
+  readonly modules: string[];
+}
+
+export interface SeedExtractionFailure {
+  readonly id: string;
+  readonly url: string;
+  readonly reason: string;
+}
+
+const REQUIRED_CSV_HEADERS = [
+  'id',
+  'track',
+  'module_primary',
+  'module_secondary',
+  'url',
+  'title',
+  'source_name',
+  'author',
+  'published_date',
+  'quality_score',
+  'why_kept',
+  'status',
+  'reject_reason',
+  'notes',
+] as const;
+
+export const MODULE_IDS = MODULE_REGISTRY.map((module) => module.id).sort();
+const MODULE_ID_SET = new Set(MODULE_IDS);
+
+export function resolveCliPath(flagValue: string | undefined, fallbackPath: string): string {
+  return resolve(process.cwd(), flagValue ?? fallbackPath);
+}
+
+export function getArgValue(args: string[], flag: string): string | undefined {
+  const index = args.indexOf(flag);
+  if (index === -1) return undefined;
+  return args[index + 1];
+}
+
+export function parseInteger(value: string, label: string): number {
+  const parsed = Number.parseInt(value, 10);
+  if (!Number.isInteger(parsed)) {
+    throw new Error(`${label} must be an integer, received "${value}"`);
+  }
+  return parsed;
+}
+
+export function readFrozenCsv(filePath: string): FrozenCsvRow[] {
+  const csv = readFileSync(filePath, 'utf8');
+  const rows = parseCsv(csv);
+  const headerRow = rows[0];
+  if (!headerRow) {
+    throw new Error(`CSV is empty: ${filePath}`);
+  }
+
+  const headers = headerRow.map((header, index) => {
+    const cleanHeader = header.trim();
+    return index === 0 ? cleanHeader.replace(/^\uFEFF/, '') : cleanHeader;
+  });
+
+  for (const header of REQUIRED_CSV_HEADERS) {
+    if (!headers.includes(header)) {
+      throw new Error(`CSV is missing required header "${header}"`);
+    }
+  }
+
+  return rows
+    .slice(1)
+    .filter((row) => row.some((cell) => cell.trim().length > 0))
+    .map((row) => {
+      const record = Object.fromEntries(
+        headers.map((header, index) => [header, row[index]?.trim() ?? '']),
+      ) as Record<string, string>;
+
+      return {
+        id: record['id'] ?? '',
+        track: record['track'] ?? '',
+        module_primary: record['module_primary'] ?? '',
+        module_secondary: record['module_secondary'] ?? '',
+        url: record['url'] ?? '',
+        title: record['title'] ?? '',
+        source_name: record['source_name'] ?? '',
+        author: record['author'] ?? '',
+        published_date: record['published_date'] ?? '',
+        quality_score: record['quality_score'] ?? '',
+        why_kept: record['why_kept'] ?? '',
+        status: record['status'] ?? '',
+        reject_reason: record['reject_reason'] ?? '',
+        notes: record['notes'] ?? '',
+      };
+    });
+}
+
+export function loadSeedArticles(filePath: string): SeedArticle[] {
+  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
+  if (!Array.isArray(raw)) {
+    throw new Error(`Seed JSON must be an array: ${filePath}`);
+  }
+
+  return raw.map((item, index) => normalizeSeedArticle(item, index));
+}
+
+export function parseModuleList(value: string): string[] {
+  return value
+    .split(',')
+    .map((moduleId) => moduleId.trim())
+    .filter((moduleId) => moduleId.length > 0);
+}
+

--- scripts/seed-corpus/validate.ts
diff --git a/scripts/seed-corpus/validate.ts b/scripts/seed-corpus/validate.ts
new file mode 100644
index 0000000..9cd1d99
--- /dev/null
+++ b/scripts/seed-corpus/validate.ts
@@ -0,0 +1,119 @@
+/**
+ * Validate seed-articles.json before writing anything to Supabase.
+ *
+ * Usage:
+ *   npm run seed-corpus:validate
+ *   npm run seed-corpus:validate -- --input path/to/seed-articles.json
+ */
+
+import {
+  DEFAULT_SEED_JSON_PATH,
+  MODULE_IDS,
+  assertKnownModules,
+  buildCoverageCounts,
+  getArgValue,
+  loadSeedArticles,
+  normalizeModules,
+  resolveCliPath,
+} from './shared.js';
+
+const MIN_TEXT_LENGTH = 1_500;
+const MAX_TEXT_LENGTH = 50_000;
+const MAX_ARTICLES_PER_SOURCE = 25;
+const MIN_ARTICLES_PER_MODULE = 3;
+
+async function main(): Promise<void> {
+  const args = process.argv.slice(2);
+  const inputPath = resolveCliPath(getArgValue(args, '--input'), DEFAULT_SEED_JSON_PATH);
+  const articles = loadSeedArticles(inputPath);
+
+  const issues: string[] = [];
+  const seenUrls = new Set<string>();
+  const sourceCounts = new Map<string, number>();
+
+  for (let index = 0; index < articles.length; index++) {
+    const article = articles[index]!;
+    const label = `article[${index}]`;
+
+    if (!article.url.trim()) issues.push(`${label} is missing url`);
+    if (!article.title.trim()) issues.push(`${label} is missing title`);
+    if (!article.source_name.trim()) issues.push(`${label} is missing source_name`);
+    if (!article.text.trim()) issues.push(`${label} is missing text`);
+
+    try {
+      void new URL(article.url);
+    } catch {
+      issues.push(`${label} has invalid URL: ${article.url}`);
+    }
+
+    if (!Number.isInteger(article.quality_score) || article.quality_score < 7 || article.quality_score > 10) {
+      issues.push(`${label} has invalid quality_score ${article.quality_score}; expected 7-10`);
+    }
+
+    if (article.text.length < MIN_TEXT_LENGTH) {
+      issues.push(`${label} text is too short (${article.text.length} chars)`);
+    }
+    if (article.text.length > MAX_TEXT_LENGTH) {
+      issues.push(`${label} text is too long (${article.text.length} chars)`);
+    }
+
+    const normalizedModules = normalizeModules(article.modules);
+    if (normalizedModules.length === 0) {
+      issues.push(`${label} has no modules`);
+    }
+    try {
+      assertKnownModules(normalizedModules, label);
+    } catch (err) {
+      issues.push(String(err));
+    }
+
+    if (seenUrls.has(article.url)) {
+      issues.push(`Duplicate URL detected: ${article.url}`);
+    } else {
+      seenUrls.add(article.url);
+    }
+
+    sourceCounts.set(article.source_name, (sourceCounts.get(article.source_name) ?? 0) + 1);
+  }
+
+  const coverage = buildCoverageCounts(articles);
+  for (const moduleId of MODULE_IDS) {
+    const count = coverage.get(moduleId) ?? 0;
+    if (count < MIN_ARTICLES_PER_MODULE) {
+      issues.push(`Coverage gap: module "${moduleId}" has ${count} article(s); expected at least ${MIN_ARTICLES_PER_MODULE}`);
+    }
+  }
+
+  for (const [sourceName, count] of sourceCounts.entries()) {
+    if (count > MAX_ARTICLES_PER_SOURCE) {
+      issues.push(`Source cap exceeded: "${sourceName}" has ${count} articles; max is ${MAX_ARTICLES_PER_SOURCE}`);
+    }
+  }
+
+  const weakestModules = [...coverage.entries()]
+    .sort((a, b) => a[1] - b[1])
+    .slice(0, 5)
+    .map(([moduleId, count]) => `${moduleId}=${count}`)
+    .join(', ');
+
+  console.log(`Validated ${articles.length} seed article(s) from ${inputPath}`);
+  console.log(`Unique URLs: ${seenUrls.size}`);
+  console.log(`Weakest modules: ${weakestModules}`);
+  console.log(`Largest source bucket: ${Math.max(...sourceCounts.values(), 0)}`);
+
+  if (issues.length > 0) {
+    console.error('');
+    console.error(`Validation failed with ${issues.length} issue(s):`);
+    for (const issue of issues) {
+      console.error(`- ${issue}`);
+    }
+    process.exit(1);
+  }
+
+  console.log('Validation passed.');
+}
+
+main().catch((err) => {
+  console.error('Seed validation failed:', err);
+  process.exit(1);
+});


--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
new file mode 100644
index 0000000..f0a82a3
--- /dev/null
+++ b/seed-articles-frozen.csv
@@ -0,0 +1,49 @@
+id,track,module_primary,module_secondary,url,title,source_name,author,published_date,quality_score,why_kept,status,reject_reason,notes
+1,track2,devops,dx,https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/,"How GitHub uses merge queue to ship hundreds of changes every day","The GitHub Blog","Will Smythe; Lawrence Gripper",2024-03-06,8,"Explains why GitHub replaced older merge and deploy flow with merge queue and shares scale-specific tradeoffs for hundreds of pull requests per day.",kept,,
+2,track2,dx,devops,https://discord.com/blog/how-discord-moved-engineering-to-cloud-development-environments,"How Discord Moved Engineering to Cloud Development Environments","Discord Engineering","Denbeigh Stevens",2024-02-22,8,"Detailed developer-experience migration from local Macs to cloud dev environments, with concrete tradeoffs around latency, reproducibility, tooling, and org adoption.",kept,,
+3,track2,observability,architecture_patterns,https://discord.com/blog/how-discord-uses-open-source-tools-for-scalable-data-orchestration-transformation,"How Discord Uses Open-Source Tools for Scalable Data Orchestration & Transformation","Discord Engineering","Zach Bluhm",2024-07-12,8,"Production data-platform rebuild with lessons on observability and self-service, including the move that now powers more than 2,000 dbt tables.",kept,,
+4,track2,ai_assisted,"integration,dx",https://discord.com/blog/developing-rapidly-with-generative-ai,"Developing Rapidly with Generative AI","Discord Engineering","Shannon Phu",2024-04-12,8,"Real GenAI product-engineering post covering staged rollout, prototyping, and deployment tradeoffs instead of generic LLM tutorials.",kept,,
+5,track2,error_resilience,"observability,security",https://blog.cloudflare.com/cloudflare-incident-on-june-20-2024/,"Cloudflare incident on June 20, 2024","Cloudflare Blog","Lloyd Wallis; Julien Desgats; Manish Arora",2024-06-26,9,"Strong incident write-up with named systems, a 114-minute outage, 2.1% error peak, and nearly 3x p99 TTFB during failure.",kept,,
+6,track2,observability,devops,https://blog.cloudflare.com/adopting-opentelemetry-for-our-logging-pipeline/,"Adopting OpenTelemetry for our logging pipeline","Cloudflare Blog","Colin Douch; Jayson Cena",2024-06-03,8,"Large-scale observability migration from syslog-ng to OpenTelemetry Collector with custom components, rollout details, and what went wrong.",kept,,
+7,track2,go_patterns,performance,https://blog.cloudflare.com/reclaiming-cpu-for-free-with-pgo/,"Reclaiming CPU for free with Go's Profile Guided Optimization","Cloudflare Blog","Colin Douch",2024-05-14,8,"Production Go optimization story using PGO with measured savings of roughly 71 to 97 CPU cores and a clear build and deploy methodology.",kept,,
+8,track2,architecture_patterns,"performance,concurrency,design_patterns",https://blog.cloudflare.com/how-we-built-cloudflare-queues/,"Durable Objects aren't just durable, they're fast: a 10x speedup for Cloudflare Queues","Cloudflare Blog","Josh Wheeler; Siddhant Sinha; Todd Mantell; Pranshu Maheshwari",2024-10-24,9,"Distributed-systems refactor with before and after metrics: latency from about 200ms to 60ms, throughput from 400 to 5,000 messages per second, and concurrency from 20 to 250.",kept,,
+9,track2,architecture_patterns,"performance,ai_assisted",https://www.linkedin.com/blog/engineering/search/reimagining-linkedins-search-stack,"Reimagining LinkedIn's search tech stack","LinkedIn Engineering Blog","Fedor Borisyuk",2026-01-21,8,"Deep architecture post on LinkedIn's search stack redesign with system-level tradeoffs and large-scale query-serving context.",kept,,
+10,track2,architecture_patterns,"concurrency,performance",https://www.linkedin.com/blog/engineering/infrastructure/introducing-northguard-and-xinfra,"Introducing Northguard and Xinfra: scalable log storage at LinkedIn","LinkedIn Engineering Blog","Onur Karaman; Xiongqi Wu",2025-06-25,9,"New distributed log-storage architecture motivated by Kafka scaling pain at 32T records per day and 17 PB per day, with clear protocol and operability tradeoffs.",kept,,
+11,track2,ai_assisted,"integration,python_patterns,dx",https://www.linkedin.com/blog/engineering/generative-ai/behind-the-platform-the-journey-to-create-the-linkedin-genai-application-tech-stack,"Behind the platform: the journey to create the LinkedIn GenAI application tech stack","LinkedIn Engineering Blog","Karthik Ramgopal; Xiaofeng Wang; Sandeep Jha",2024-11-26,9,"Rare candid GenAI platform post about Python versus Java, LangChain adoption, memory and tooling, and long-term leverage decisions at LinkedIn scale.",kept,,
+12,track2,error_resilience,"performance,concurrency",https://www.uber.com/blog/from-static-rate-limiting-to-intelligent-load-management/,"How Uber Conquered Database Overload: The Journey from Static Rate-Limiting to Intelligent Load Management","Uber Engineering","Dhyanam Vaidya; Prathamesh Deshpande; Mike Ma; Chaitanya Yalamanchili",2026-01-13,9,"Excellent resilience case study with measured wins: 80% higher throughput, about 70% lower p99 latency, about 93% fewer goroutines, and about 60% lower heap under overload.",kept,,
+13,track2,performance,"architecture_patterns,error_resilience",https://www.uber.com/blog/how-uber-serves-over-150-million-reads/,"How Uber Serves over 150 Million Reads per Second from Integrated Cache with Stronger Consistency Guarantees","Uber Engineering","Preetham Narayanareddy; Eli Pozniansky",2025-08-26,9,"Cache-consistency architecture post at extreme scale, covering more than 150 million reads per second and tradeoffs between hit rate, invalidation, and correctness.",kept,,
+14,track2,ai_assisted,"security,testing",https://www.uber.com/blog/ureview/,"uReview: Scalable, Trustworthy GenAI for Code Review at Uber","Uber Engineering","Shauvik Roy Choudhary; Sonal Mahajan; Will Bond",2025-08-12,9,"High-signal AI-assisted engineering post with real adoption numbers: 90% of weekly about 65,000 diffs analyzed, 75% useful comments, and 1,500 hours saved per week.",kept,,
+15,track2,go_patterns,"performance,ai_assisted",https://www.uber.com/blog/perfinsights/,"PerfInsights: Detecting Performance Optimization Opportunities in Go Code using Generative AI","Uber Engineering","Ryan Hang; Sung Whang; Joseph Wang",2025-07-22,9,"Go-specific performance tooling post with production profiles, LLM validation layers, and measurable reductions in false positives and engineering effort.",kept,,
+16,track2,testing,"integration,dx",https://github.blog/engineering/engineering-principles/how-githubs-developer-experience-team-improved-innerloop-development/,"How GitHub's Developer Experience team improved innerloop development","The GitHub Blog","Belal Taher",2024-01-24,8,"Good production post on integration testing in a distributed microservice ecosystem, including the tooling tradeoffs GitHub made to speed the inner loop.",kept,,
+17,track2,testing,"performance,devops",https://github.blog/2024-06-03-how-github-reduced-testing-time-for-ios-apps-with-new-runner-features/,"How GitHub reduced testing time for iOS apps with new runner features","The GitHub Blog","Eli Perkins",2024-06-03,8,"Concrete CI and runner story about build and test acceleration for a real mobile app, grounded in measurable workflow improvements.",kept,,
+18,track2,api_design,"integration,dx",https://stripe.com/blog/introducing-stripes-new-api-release-process,"Introducing Stripe's new API release process","Stripe Blog","Michael Glukhovsky; Wissam Abirached",2024-10-01,8,"Strong API-evolution piece with explicit versioning and release-cadence tradeoffs aimed at making large integrations safer and more predictable.",kept,,
+19,track2,security,"observability,error_resilience",https://engineering.fb.com/2024/11/12/security/how-meta-built-large-scale-cryptographic-monitoring/,"How Meta built large-scale cryptographic monitoring","Engineering at Meta","Hussain Humadi; Sasha Frolov; Rafael Misoczki; Siddhartha Khetawat; Dong Wu",2024-11-12,9,"Detailed security engineering post on monitoring cryptography use at fleet scale to catch weak algorithms, support migrations, and protect reliability.",kept,,
+20,track2,java_patterns,"type_system,evolutionary",https://engineering.fb.com/2024/12/18/android/translating-java-to-kotlin-at-scale/,"Translating Java to Kotlin at Scale","Engineering at Meta","Jocelyn Luizzi; Jingbo Yang; Eve Matthaey",2024-12-18,9,"Large migration story covering roughly ten million lines of Java, null-safety tradeoffs, custom tooling, and the realities of incremental modernization.",kept,,
+21,track2,python_patterns,"type_system,dx",https://engineering.fb.com/2025/05/15/developer-tools/introducing-pyrefly-a-new-type-checker-and-ide-experience-for-python/,"Introducing Pyrefly: A new type checker and IDE experience for Python","Engineering at Meta","Meta Engineering",2025-05-15,8,"Python tooling article with real scale constraints, showing why Meta rebuilt its type-checking stack for IDE speed, incrementality, and large codebases.",kept,,
+22,track2,react_patterns,"performance,dx",https://react.dev/blog/2024/10/21/react-compiler-beta-release,"React Compiler Beta Release","React Blog","Lauren Tan",2024-10-21,8,"Relevant React production write-up because it includes rollout details from Meta apps, a 100k-plus component monorepo context, and practical adoption guidance.",kept,,
+23,track2,design_patterns,"concurrency,python_patterns",https://www.linkedin.com/blog/engineering/infrastructure/how-design-patterns-power-linkedin-infrastructure,"Navigating the scale: how design patterns power LinkedIn's infrastructure","LinkedIn Engineering Blog","Saira Khanum",2024-11-07,9,"Exactly the kind of production design-pattern article we need: producer-consumer at LinkedIn scale with tradeoffs, queues, workers, and locking behavior.",kept,,
+24,track2,dependency_health,"dx,security",https://engineering.fb.com/2024/02/06/developer-tools/dotslash-simplified-executable-deployment/,"DotSlash: Simplified executable deployment","Engineering at Meta","Michael Bolin; Andres Suarez",2024-02-06,9,"Useful supply-chain and tool-distribution post about versioned executable delivery, provenance, cache behavior, and reducing heavy dependency deployment pain.",kept,,
+25,track2,evolutionary,"devops,security,dependency_health",https://www.linkedin.com/blog/engineering/architecture/navigating-the-transition-adopting-azure-linux-as-linkedins-operatingsystem,"Navigating the transition: adopting Azure Linux as LinkedIn's operating system","LinkedIn Engineering Blog","Ievgen Priadka; Sweekar Pinto; Bubby Rayber",2024-08-19,9,"High-signal migration case study covering fleetwide OS evolution, security-update constraints, and bootstrap time dropping from over an hour to 10-30 minutes.",kept,,
+26,track2,evolutionary,"integration,design_patterns",https://www.linkedin.com/blog/engineering/infrastructure/journey-of-next-generation-control-plane-for-data-systems,"Journey of next generation control plane for data systems","LinkedIn Engineering Blog","Aashish Nagpal; Nishant Satya Lakshmikanth; Ramnik Bhatia; Vivek Subramaniam",2025-03-21,9,"Strong platformization story about evolving Nuage into a control plane, with measurable latency gains and clear resource-management tradeoffs.",kept,,
+27,track2,complexity,"dx,architecture_patterns",https://engineering.fb.com/2024/12/19/developer-tools/glean-open-source-code-indexing/,"Indexing code at scale with Glean","Engineering at Meta","Simon Marlow; Pepe Iborra",2024-12-19,8,"Valuable article on reducing codebase comprehension complexity through centralized indexing, shared facts, and distributed query architecture.",kept,,
+28,track2,security,"integration,performance",https://discord.com/blog/meet-dave-e2ee-for-audio-video,"Meet DAVE: Discord's New End-to-End Encryption for Audio & Video","Discord Engineering","Stephen Birarda",2024-09-17,9,"Security architecture deep dive with explicit protocol goals, scalability constraints, rollout mechanics, and tradeoffs for real-time encrypted media at Discord.",kept,,
+29,track2,type_system,"python_patterns,dx",https://engineering.fb.com/2024/12/09/developer-tools/typed-python-2024-survey-meta/,"Typed Python in 2024: Well adopted, yet usability challenges persist","Engineering at Meta","Aaron Pollack",2024-12-09,8,"Survey-backed practitioner piece with more than 1,000 responses on why teams use Python typing, where tooling hurts, and what blocks broader adoption.",kept,,
+30,track2,react_patterns,"performance,complexity,js_advanced",https://react.dev/blog/2024/02/15/react-labs-what-we-have-been-working-on-february-2024,"React Labs: What We've Been Working On - February 2024","React Blog","Joseph Savona; Ricky Hanlon; Andrew Clark; Matt Carroll; Dan Abramov",2024-02-15,8,"High-signal React engineering update that grounds compiler adoption in real production rollout, and explicitly frames manual memoization as a complexity and performance tradeoff.",kept,,
+31,track2,react_patterns,"performance,clean_code,js_advanced",https://react.dev/blog/2025/10/07/react-compiler-1,"React Compiler v1.0","React Blog","Lauren Tan; Joe Savona; Mofei Zhang",2025-10-07,9,"Production-focused React article with concrete wins up to 12% faster loads and 2.5x faster interactions, while reducing memoization boilerplate and catching rules violations.",kept,,
+32,track2,react_patterns,"performance,dx",https://engineering.fb.com/2024/10/02/android/react-at-meta-connect-2024/,"React at Meta Connect 2024","Engineering at Meta","Blair Vanderhoof; Jesse Watts-Russell; Fernando Gorodscy; Matt Galloway; Eli White",2024-10-02,8,"Strong multi-product React case study covering code sharing, performance tuning, and cross-platform delivery across Quest, Horizon, and desktop tools at Meta scale.",kept,,
+33,track2,clean_code,"testing,complexity",https://github.blog/developer-skills/github/how-to-review-code-effectively-a-github-staff-engineers-philosophy/,"How to review code effectively: A GitHub staff engineer's philosophy","The GitHub Blog","Sarah Vessels",2024-07-23,8,"Practical clean-code article from a staff engineer who reviewed more than 7,000 pull requests, with concrete tradeoffs around blockers, tests, and review quality.",kept,,
+34,track2,clean_code,"testing,complexity",https://github.blog/news-insights/research/does-github-copilot-improve-code-quality-heres-what-the-data-says/,"Does GitHub Copilot improve code quality? Here's what the data says","The GitHub Blog","Jared Bauer",2024-11-18,9,"Evidence-backed code-quality study: Copilot users had a 53.2% higher likelihood of passing all tests and produced 13.6% more lines per readability error.",kept,,
+35,track2,clean_code,"testing,complexity,ai_assisted",https://github.blog/ai-and-ml/github-copilot/60-million-copilot-code-reviews-and-counting/,"60 million Copilot code reviews and counting","The GitHub Blog","Ria Gopu; David Apirian",2026-03-05,8,"Shows how GitHub tuned AI code review for signal over noise, including 71% of reviews surfacing actionable feedback and explicit tradeoffs between latency and review quality.",kept,,
+36,track2,elixir_patterns,"concurrency,architecture_patterns",https://fly.io/phoenix-files/world-page-speed-test-elastic-scale-with-flame/,"World Page Speed Test - planet-wide elastic scale with FLAME","The Phoenix Files","Chris McCord",2024-05-08,8,"Elixir-specific production article on using FLAME and the BEAM for elastic multi-region execution, with concrete concurrency and scaling design lessons.",kept,,
+37,track2,elixir_patterns,"integration,python_patterns",https://dashbit.co/blog/running-python-in-elixir-its-fine,"Embedding Python in Elixir, it's Fine","Dashbit Blog","Jonatan Klosko",2025-02-21,8,"Candid language-integration post that explains why Dashbit embedded Python into Elixir, including the safety and interoperability tradeoffs around NIFs versus other approaches.",kept,,
+38,track2,elixir_patterns,"type_system,evolutionary",https://dashbit.co/blog/data-evolution-with-set-theoretic-types,"Data evolution with set-theoretic types","Dashbit Blog","Jose Valim",2025-01-14,8,"Language-design article that tackles backward-compatible data evolution with explicit type-system tradeoffs, useful seed material for Elixir-specific reasoning.",kept,,
+39,track2,go_patterns,performance,https://www.uber.com/blog/automating-efficiency-of-go-programs-with-pgo/,"Automating Efficiency of Go programs with Profile-Guided Optimizations","Uber Engineering","Yufan Xu; Shauvik Roy Choudhary; Chris Zhang; Milind Chabbi",2025-03-13,9,"Excellent Go performance post with fleet-scale deployment details, about 4% gains, and a reduction of 24,000 CPU cores across top services.",kept,,
+40,track2,java_patterns,"dx,performance",https://engineering.fb.com/2025/08/26/open-source/enabling-kotlin-incremental-compilation-on-buck2/,"Enabling Kotlin incremental compilation on Buck2","Engineering at Meta","Iveta Kovalenko",2025-08-26,9,"Great JVM-tooling article on bringing Kotlin incremental compilation to Buck2, with critical modules building up to 3x faster and average developer builds improving about 30%.",kept,,
+41,track1,api_design,"integration,design_patterns",https://slack.engineering/how-we-design-our-apis-at-slack/,"How We Design Our APIs at Slack","Engineering at Slack","Saurabh Sahni; Taylor Singletary",2021-08-11,9,"Still one of the clearest production API-design articles around, with concrete scale pain from large payloads and explicit principles for evolving developer-facing APIs.",kept,,classic pre-2024 exception; keep unless we find a fresher official equivalent
+42,track1,api_design,"integration,evolutionary",https://slack.engineering/evolving-the-slack-api/,"Evolving the Slack API","Engineering at Slack","Brenda Jin",2018-01-25,9,"Canonical API-evolution write-up showing how Slack redesigned its Conversations API to preserve backwards compatibility while fixing old platform constraints.",kept,,classic pre-2024 exception; keep unless we find a fresher official equivalent
+43,track2,dependency_health,"design_patterns,evolutionary",https://engineering.fb.com/2025/10/16/developer-tools/branching-in-a-sapling-monorepo/,"Branching in a Sapling Monorepo","Engineering at Meta","Meta Engineering",2025-10-16,8,"Useful monorepo article on balancing branching strategy with unified dependency management, large-scale refactoring, and version drift in a huge codebase.",kept,,
+44,track2,java_patterns,"performance,devops",https://quarkus.io/blog/mmaler-blogpost-1-intro/,"Optimizing Java for the Cloud-Native Era with Quarkus","Quarkus Blog","Michal Mickey Maler",2025-04-10,8,"Strong cloud-native Java article that explains why teams adopt Quarkus for fast startup, lighter footprint, and Kubernetes-friendly operations, backed by real user-story tradeoffs.",kept,,
+45,track2,js_advanced,performance,https://discord.com/blog/how-discord-seamlessly-upgraded-millions-of-users-to-64-bit-architecture,"How Discord Seamlessly Upgraded Millions of Users to 64-bit Architecture","Discord Engineering","Jesse O'Brien",2024-12-13,8,"Useful low-level JavaScript platform story about Electron and V8 migration tradeoffs, memory ceilings, native-module constraints, and real user-impact at Discord scale.",kept,,
+46,track2,go_patterns,error_resilience,https://blog.cloudflare.com/go-and-enhance-your-calm/,"Go and enhance your calm: demolishing an HTTP/2 interop problem","Cloudflare Blog","Lucas Pardue; Zak Cutner",2025-10-31,8,"Go production debugging story about HTTP/2 interoperability, with a concrete failure mode that triggered Cloudflare defenses and a precise remediation in the client.",kept,,
+47,track2,error_resilience,"go_patterns,devops",https://blog.cloudflare.com/improving-platform-resilience-at-cloudflare/,"Improving platform resilience at Cloudflare through automation","Cloudflare Blog","Opeyemi Onikute",2024-10-09,8,"Production reliability post on self-healing infrastructure, auto-remediation, and how Cloudflare reduces toil while recovering from predictable failures at scale.",kept,,
+48,track2,go_patterns,performance,https://blog.cloudflare.com/how-we-found-a-bug-in-gos-arm64-compiler/,"How we found a bug in Go's arm64 compiler","Cloudflare Blog","Thea Heinen",2025-10-08,9,"Excellent Go incident-analysis article where Cloudflare's fleet scale exposed a rare compiler race condition and drove a root-cause investigation down to assembly.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
new file mode 100644
index 0000000..ecbab5a
--- /dev/null
+++ b/seed-articles.json
@@ -0,0 +1,491 @@
+[
+  {
+    "url": "https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/",
+    "title": "How GitHub uses merge queue to ship hundreds of changes every day",
+    "source_name": "The GitHub Blog",
+    "text": "Here’s how merge queue transformed the way GitHub deploys changes to production at scale, so you can do the same for your organization. March 6, 2024 | 7 minutes Share: At GitHub, we use merge queue to merge hundreds of pull requests every day. Developing this feature and rolling it out internally did not happen overnight, but the journey was worth it—both because of how it has transformed the way we deploy changes to production at scale, but also how it has helped improve the velocity of customers too. Let’s take a look at how this feature was developed and how you can use it, too. Why we needed merge queue In 2020, engineers from across GitHub came together with a goal: improve the process for deploying and merging pull requests across the GitHub service, and specifically within our largest monorepo. This process was becoming overly complex to manage, required special GitHub-only logic in the codebase, and required developers to learn external tools, which meant the engineers developing for GitHub weren’t actually using GitHub in the same way as our customers. To understand how we got to this point in 2020, it’s important to look even further back. By 2016, nearly 1,000 pull requests were merging into our large monorepo every month. GitHub was growing both in the number of services deployed and in the number of changes shipping to those services. And because we deploy changes prior to merging them, we needed a more efficient way to group and deploy multiple pull requests at the same time. Our solution at this time was trains . A train was a special pull request that grouped together multiple pull requests (passengers) that would be tested, deployed, and eventually merged at the same time. A user (called a conductor) was responsible for handling most aspects of the process, such as starting a deployment of the train and handling conflicts that arose. Pipelines were added to help manage the rollout path. Both these systems (trains and pipelines) were only used on our largest monorepo and were implemented in our internal deployment system. Trains helped improve velocity at first, but over time started to negatively impact developer satisfaction and increase the time to land a pull request. Our internal Developer Experience (DX) team regularly polls our developers to learn about pain points to help inform where to invest in improvements. These surveys consistently rated deployment as the most painful part of the developer’s daily experience, highlighting the complexity and friction involved with building and shepherding trains in particular. This qualitative data was backed by our quantitative metrics. These showed a steady increase in the time it took from pull request to shipped code. Trains could also grow large, containing the changes of 15 pull requests. Large trains frequently “derailed” due to a deployment issue, conflicts, or the need for an engineer to remove their change. On painful occasions, developers could wait 8+ hours after joining a train for it to ship, only for it to be removed due to a conflict between two pull requests in the train. Trains were also not used on every repository, meaning the developer experience varied significantly between different services. This led to confusion when engineers moved between services or contributed to services they didn’t own, which is fairly frequent due to our inner source model. In short, our process was significantly impacting the productivity of our engineering teams—both in our large monorepo and service repositories. Building a better solution for us and eventually for customers By 2020, it was clear that our internal tools and processes for deploying and merging across our repositories were limiting our ability to land pull requests as often as we needed. Beyond just improving velocity, it became clear that our new solution needed to: Improve the developer experience of shipping. Engineers wanted to express two simple intents: “I want to ship this change” and “I want to shift to other work;” the system should handle the rest. Avoid having problematic pull requests impact everyone. Those causing conflicts or build failures should not impact all other pull requests waiting to merge. The throughput of the overall system should be favored over fairness to an individual pull request. Be consistent and as automated as possible across our services and repositories. Manual toil by engineers should be removed wherever possible. The merge queue project began as part of an overall effort within GitHub to improve availability and remove friction that was preventing developers from shipping at the frequency and level of quality that was needed. Initially, it was only focused on providing a solution for us, but was built with the expectation that it would eventually be made available to customers. By mid-2021, a few small, internal repositories started testing merge queue, but moving our large monorepo would not happen until the next year for a few reasons. For one, we could not stop deploying for days or weeks in order to swap systems. At every stage of the project we had to have a working system to ship changes. At a maximum, we could block deployments for an hour or so to run a test or transition. GitHub is remote-first and we have engineers throughout the world, so there are quieter times but never a free pass to take the system offline. Changing the way thousands of developers deploy and merge changes also requires lots of communication to ensure teams are able to maintain velocity throughout the transition. Training 1,000 engineers on a new system overnight is difficult, to say the least. By rolling out changes to the process in phases (and sometimes testing and rolling back changes early in the morning before most developers started working) we were able to slowly transition our large monorepo and all of our repositories responsible for production services onto merge queue by 2023. How we use merge queue today Merge queue has become the single entry point for shipping code changes at GitHub. It was designed and tested at scale, shipping 30,000+ pull requests with their associated 4.5 million CI runs, for GitHub.com before merge queue was made generally available . For GitHub and our “deploy the merge process,” merge queue dynamically forms groups of pull requests that are candidates for deployment, kicks off builds and tests via GitHub Actions, and ensures our main branch is never updated to a failing commit by enforcing branch protection rules. Pull requests in the queue that conflict with one another are automatically detected and removed, with the queue automatically re-forming groups as needed. Because merge queue is integrated into the pull request workflow (and does not require knowledge of special ChatOps commands, or use of labels or special syntax in comments to manage state), our developer experience is also greatly improved. Developers can add their pull request to the queue and, if they spot an issue with their change, leave the queue with a single click. We can now ship larger groups without the pitfalls and frictions of trains. Trains (our old system) previously limited our ability to deploy more than 15 changes at once, but now we can now safely deploy 30 or more if needed. Every month, over 500 engineers merge 2,500 pull requests into our large monorepo with merge queue, more than double the volume from a few years ago. The average wait time to ship a change has also been reduced by 33% . And it’s not just numbers that have improved. On one of our periodic developer satisfaction surveys, an engineer called merge queue “one of the best quality-of-life improvements to shipping changes that I’ve seen a GitHub!” It’s not a stretch to say that merge queue has transformed the way GitHub deploys changes to production at scale. How to get started Merge queue is available to public repositories on GitHub.com owned by organizations and to all repositories on GitHub Enterprise (Cloud or Server). To learn more about merge queue and how it can help velocity and developer satisfaction on your busiest repositories, see our blog post, GitHub merge queue is generally available . Tags: Collaboration Core productivity developer experience GitHub Enterprise How GitHub builds GitHub pull requests Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "devops",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/how-discord-moved-engineering-to-cloud-development-environments",
+    "title": "How Discord Moved Engineering to Cloud Development Environments",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers Denbeigh Stevens February 22, 2024 Introduction If you've been following our previous engineering blog posts , you'll know that building and maintaining Discord is a complex task. Our software development takes place in a polyglot mono-repo, where Python, Typescript, Rust, Elixir, and C/C++ are the most actively developed languages. We also develop and ship products for all major platforms including Android, iOS, MacOS, Windows, and Linux. The Internal Developer Experience team is responsible for roughly the first third of the Software Development Life Cycle. Our main tasks include building and maintaining IDE experiences, managing development environments, shipping tools for building, developing, and testing code, scaling and maintaining CI infrastructure, and owning the change management process and supporting tooling infrastructure. While we could delve deeper into any of these topics, this blog post focuses on how we transitioned all backend and infrastructure development to a Linux-based Cloud Development Environment, thanks to the team over at Coder . Background Over the past few years, Discord's engineering organization has gone through rapid growth and more than tripled in size. Discord operates as a hybrid company with a physical office in San Francisco and the Netherlands, but our engineering team primarily operates remotely. Most of our developers use MacBooks. Before transitioning to remote development machines, we ensured that engineers could fully stand up Discord on both Mac and Ubuntu machines, and created custom tools to provision laptops using Homebrew. However, we encountered several issues where a brew upgrade could halt a developer in their tracks. We resolved many of these issues by hard-pinning every software package and transitive dependency, although this made it more difficult to install arbitrary software packages. We have since moved from Homebrew to Nix for installing system dependencies, allowing engineers to use Homebrew as needed. Our local service orchestration tools have also evolved. We began with Makefiles and procfiles, but quickly outgrew this system. We experimented with Docker and docker-compose, but for various reasons, this did not work for us. At that time, the performance on docker-for-Mac performance was subpar, and the added friction in the (re)-build loop led us to seek faster, simpler solutions. We eventually moved to a supervisor -based system and developed tools to easily define and run services and dependencies. However, not using containers in the development loop comes with trade-offs. Managing two non-reproducible environments became a significant burden for the tooling teams. We often found ourselves debugging niche and unique issues to unblock engineers. As the company continued to grow, it became clear that we needed to focus on a single Linux-based development environment. This led us to explore Cloud Developer Environments (CDEs) and eventually evaluate Coder. Cloud Development Environments Shifting development to VMs hosted on a cloud provider yields numerous benefits, such as immutability, reproducibility, configurability, enhanced security, and built-in IAM. Additionally, it provides access to a broader range of tooling and automation options to manage and maintain the environments. A core requirement for CDEs to even be viable is a good editor and dev loop experience. Fortunately, VS Code’s remote development extension was stable and offered a robust experience. Most engineers at Discord used VSCode, so we felt the experience was good enough to embark on this journey. Reproducible and consistent environments are critical for a stable experience. Although a completely immutable environment would be theoretically ideal, it's just not practical. We chose to mount and preserve the /home directory across restarts, allowing developers to pick up exactly where they left off. This provides a space for storing repos, dotfiles, personal tools, and for customizing their workspace. While this approach deviates from some immutability principles and can introduce potential issues, we can still update the template and image without needing a full workspace rebuild, giving us the best of both worlds. While there are many benefits to CDEs, it's important to acknowledge the drawbacks. Notably, no solution can rival the performance of working on localhost, and the added latency from working over SSH can be substantial. In unstable network conditions, latency, connection drops, and a generally degraded experience were reported. Sending large HTML and JavaScript bundles over the network adds significant time to critical save and rebuild loops. Consequently, many engineers prefer to do their frontend work on their local laptops and backend work on their remote machines. This approach necessitates a \"split-brain\" repository or code syncing between the laptop and remote machine when changes to both API and UI code are necessary. This increases cognitive load and is certainly not an ideal situation. Still, even with these tradeoffs, we firmly believed the benefits outweigh the negatives! Coder Our initial engagement with Coder began in late 2020. At the time, Coder was a small engineering team, and they were avid Discord users. Their early product was entirely Kubernetes native, which appealed to us as Discord is a heavy Kubernetes user. Considering the time and effort to build a similar solution with the features we needed, evaluating Coder’s product was an obvious decision. Feature-wise, Coder provides all the bells and whistles you'd expect and the team recently rebuilt their product from the ground up, addressing many of the issues we had experienced in our early engagement. Notably, we encountered many issues using Kubernetes and containers as the main development environment. Developing Discord requires a highly complex environment with many moving parts, and as we found, developing in a Sysbox environment made it challenging to maintain and debug the various issues across the many layers of virtualization. Additionally, we saw issues with noisy neighbors, lag spikes, and higher-than-expected latency. In 2023, we moved to Coder’s V2 product which gives us the power to deliver VMs to developers, largely solving most of our problems. Another notable change in their V2 product was a rewrite of their networking stack, which now leverages Tailscale & WireGuard for much more stable, secure, and performant networking. Moving to VMs gives us full access to the host and has drastically simplified the architecture, resulting in a stable and fast environment. After the migration to V2, we received a ton of feedback from engineers that development generally felt faster and smoother. Additionally, we no longer see support tickets and questions about high latency and connection drops. These are huge wins across the board. So, how did the migration go? Our transition from local development on MacBooks to using Coder was a journey full of learning and adaptation. Here's a detailed account of our migration process, the lessons we learned, and what we would do differently if we were to do it again. The Migration The (very) simplified migration plan looked like this: Solidify the experience - default experience should “just work” Increase broader adoption - small tests with developers, collect representative feedback, then move to open beta Hard cutoff - solid docs, wider training, support channels, and fully deprecate backend dev on MacBooks Our migration started with the “easy” work of creating the dev container, installing system dependencies, setting up user accounts, permissions, and any pre-existing software that needed to be installed. Investing a little into our own automation to make our feedback loops fast was important for velocity during this time. I said “easy” work above, because these types of migrations are not just technical problems, but largely people problems. It’s easy to miss how much work it takes to execute a large migration impacting the entire engineering org. We needed to understand what kinds of experiences people would be missing, what they would need to learn, and where they would feel the most pain. We conducted interviews, got early feedback, and of course, dogfooded the environment ourselves. To gain widespread adoption within the company, we identified and recruited \"champions\" from various departments who were enthusiastic about tooling. These individuals helped test the new environment and provided regular feedback. The diversity in day-to-day loops and needs was crucial, as it allowed us to identify a wide range of issues that could arise during daily development. We found numerous issues through this process and collaborated closely with these early beta testers to address their concerns. We benchmarked different build tools, conducted network load tests, and ensured that the most common development loops remained functional and efficient. We believe that if we develop and deliver tools that enhance engineering experiences, developers will be naturally incentivized to adopt the new functionality. We understood a hard cutover date would be required since there will always be some who resist change, but we strived to offer such a compelling experience that people would opt to transition independently. Of course, we nudged people to try Coder when their MacBooks had issues, but we saw a reassuring number of individuals willing to experiment with the remote environment. With the arrival of Apple’s M1 ARM-based silicon, we accelerated our timeline and decided to move quicker on the cutoff date. New M1 laptops were starting to ship to developers and we found several issues running our backend stack on the new hardware. Rosetta emulation worked for some applications, but not all. When we discovered that the only new hardware available was Apple Silicon, we decided to fast-track milestone 3, deprecate MacOS-based backend development, and choose an accelerated timeline for the transition. Lessons Learned We learned that emulating a development machine in a container running in Kubernetes is challenging. For instance, running privileged containers was not an option for us, so we had to find unique solutions for changing kernel parameters in development. This posed difficulties in running applications like Scylla, which required kernel modules or kernel parameter updates. We solved this by having a privileged daemon on each node to set kernel parameters for the underlying host. However, we faced other issues and, in retrospect, could have identified these problems and planned for them in advance. It's a given, but we also learned how much developers value responsiveness. If developers can type faster than the system can render, it can disrupt their workflow. We also recognized the importance of a smooth onboarding process, especially for developers not comfortable with the command line. We added documentation, training materials, recorded videos, and created rich default dotfiles for those that don’t come with many years of highly tuned tools. We spent a considerable amount of time on this “last-mile” work, but it still felt insufficient to meet everyone's needs. What We Would Do Differently The primary issue that emerged after the migration was around networking latency and connection drops. Given our highly-distributed environment with engineers working across the US and in various other locations, it was challenging to anticipate the worst-case scenarios. Although we leveraged Coder's early satellite feature to establish Kubernetes clusters in different regions and reduce latency, some developers still encountered significant performance issues. In retrospect, we should have developed better tooling to understand, diagnose, and troubleshoot these issues under different networking conditions as they occurred. While we did eventually create these tools, they came after the migration, leaving us somewhat in the dark. Most of these issues have been resolved thanks to a rebuilt networking stack and the switch to VMs. However, an early focus on these issues would have equipped us with the knowledge to better understand the user experience. For any large-scale migrations, it's crucial to significantly invest in communication and documentation. Requesting all of your engineers to overhaul their entire development workflow is a major ask. Although we communicated the change in all-hands meetings, signaled the change in advance, and held an extensive beta testing period, we still feel we could have done more to ensure a smoother transition. Despite the challenges and the need for two migrations (Mac→V1→V2), our move to remote dev machines using Coder has been remarkably successful. The timing was fortuitous, as we embarked on this journey before the pandemic began. Now, with a highly distributed Discord engineering team across the US, we are incredibly grateful for our partnership with Coder. It has provided our developers with a more consistent and reliable development environment and while it was a significant investment for the company, it’s one we would make again. Denbeigh Stevens Build, Dev, Test, and the Kitchen Sink at Discord related articles . Search",
+    "quality_score": 8,
+    "modules": [
+      "dx",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/how-discord-uses-open-source-tools-for-scalable-data-orchestration-transformation",
+    "title": "How Discord Uses Open-Source Tools for Scalable Data Orchestration & Transformation",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers Zach Bluhm July 12, 2024 At Discord, we take pride in making data-driven decisions to deliver a great experience for users around the world. As our platform and user base have grown over the years, so have the demands on our data orchestration system. Until recently, we’ve been using Derived , an in-house orchestration system that’s provided the foundation for Discord’s data analytics over the last five years. As our data organization grew, it became apparent that both self-service and top-notch observability would be key for our ability to effectively scale as a team. To continue delivering seamless service and insightful data analytics, we embraced an ambitious project: to overhaul our data orchestration infrastructure using modern, open-source tools . Keep reading to learn about how we embarked on this journey, the candid lessons we learned along the way, and how our new system is powering over 2000 dbt tables today. Reflecting on Derived Derived was originally engineered in-house to fulfill our requirements when we used to have a relatively smaller user base and a more manageable data volume. It played its part well during our earlier days, but our flexibility and observability requirements have substantially increased over time. Similarly, where we previously relied on software engineers to manage the system, the intent now is to foster greater self-service and maintain a more user-friendly design. While Derived was instrumental in providing advanced features and setting a foundation of expectations for data transformation systems at Discord, it missed the mark in offering usability and flexibility. We had outgrown our system, which led us to the next iteration of our data transformation journey. If you’d like to learn about Derived and how it worked, check out a previous blog post written here Dagster & dbt: a match made in heaven There’s been a lot of innovation in the data orchestration space since Airflow, an orchestration platform created by Airbnb, was open-sourced back in 2015. Today, a Google search for “open source data orchestration tool” will net you things like Argo, Prefect, Dagster, Kestra, and Mage to name a few. On the modeling side, you’ll find tools like dbt, Coalesce, and SQLMesh. The breadth of functionality around dbt made it a straightforward pick for our data modeling tool. However, our team had to spend a bit of extra time to find the right data orchestrator that would help solve the pain points that both our customers and our team were experiencing with Derived. There were a few key criteria we felt were imperative during our search: Declarative automation: there was conviction around this being a necessary component of our self-service model. It helped enable the types of flexibility our users were accustomed to in our old system. A modern UI that provided a “single pane of glass” for our data engineers and data scientists. In the ideal world, this would allow for total data asset self-service, from observability to operations. Reliability and scalability: running orchestration workloads on Kubernetes is tried and true, and we felt strongly that any serious contender needed to work with Kubernetes to be considered. Integration with existing tooling: How quickly and easily can our existing Airflow jobs, CI/CD scaffolds and data quality solutions be migrated over without too much disruption? Ultimately, our team landed on a combination of Dagster and dbt . While Dagster was a newer kid on the block and was less battle-proven than airflow, it hit the mark on our four criteria above: It provided out-of-the-box support for deployment and execution on Kubernetes , had built-in support for declarative automation , and provided a UI that allowed data producers and consumers to quickly understand the state of their data assets. Plus, its airflow integration and Python APIs meant migrating over existing jobs would be less of a burden. Although it wasn't part of our initial requirements, we were pleasantly surprised by how straightforward it was to run Dagster locally. Our developers and pilot testers were able to create a mock environment locally that enabled them to get a good sense of how the Dagster API functioned and how our use case would fit into it. There is some inherent risk with betting on newer technologies, but Discord is no stranger to moving fast and leveraging the bleeding edge . Dagster’s openness to work with us and build out new functionality to handle our scale gave us the confidence to ultimately move forward and break ground on the new system. Breaking ground on our new data transformation system Building out our new system was a journey — one that had a healthy balance of both technical challenges and “aha” moments as things “just worked”. Thanks to Dagster’s out-of-the-box support for deploying to Kubernetes, we were able to get things running quickly. Integrating dbt with Dagster using software-defined assets felt natural and quickly became a standard part of our team’s nomenclature: off-the-bat, our team made the crucial decision to utilize dbt mainly for SQL templating, managing data quality tests, configuring asset metadata, and execution of queries. Dagster would be the true “brain” behind the orchestration and would be responsible for things running in the correct order. We decided to schedule our entire DAG using Dagster's declarative automation mechanism, triggered by scheduled runs that monitored our raw data layer. The declarative nature of this scheduling allows our data producers to easily create dependencies between wildly varying partition definitions (think “hourly → daily”) without having to implement custom logic. Learn more about declarative automation and how it differs from cron-based scheduling here . With these decisions in place, we focused on building out a minimum lovable product to enable our data engineering crew to begin modeling our new data architecture in parallel as soon as possible. This allowed for fast feedback on the new mechanisms we were building into the system, including components such as custom partition mappings, dbt test execution, and custom dbt model configurations. It took a couple of tries to get right from both a user interface and functionality perspective, but ultimately we engineered a system that combined the advanced modeling capabilities of dbt with the cutting-edge scheduling and out-of-the-box visibility provided by Dagster. Hourly data maps to daily models with ease, requiring no additional effort from data producers We eventually realized that we could leverage Dagster Labs' Hybrid Cloud offering, Dagster+ , to enable our small and mighty team to move faster. This decision offloaded a lot of the time we spent on correctly configuring infrastructure and debugging behind-the-scenes issues, letting us focus on what mattered most: data orchestration. Plus, features included in Dagster+, such as SSO and branch deployments, gave our new system a final layer of polish that enhanced both our productivity and the overall quality of our data workflows. Lessons learned While we were getting our new systems established, there were a couple of issues we identified early on that we knew would have to be solved before we could enable the system in production. For one, dbt did not support parallelism well . For incremental models, dbt stores data in a temporary table before merging the processed partitions in its production location. This created a race condition when multiple instances of dbt run were initiated for the same model, as dbt would try to delete the temporary table once it was completed. We solved this by adjusting dbt’s logic for storing temporary data, which enabled us to run multiple partitions of the same asset in parallel. Second, backfilling assets partition-by-partition did not play well with our data warehouse (BigQuery) and led to extremely lengthy backfill times. We worked closely with the Dagster team to push an open-source commit , which resulted in us being able to configure how many partitions could be backfilled at once for each asset. One more challenge we faced stemmed from a constraint that we felt was critical for the high bar of data quality that our data consumers expect: atomicity and data consistency. In essence, the code-version for an asset needed to remain consistent across partitions, even while backfilling. While not supported out of the box, Dagster provides a flexible graphQL interface which, in combination with a series of sensors and jobs , enabled us to bring this functionality to life! How users are benefiting from the new system Once the core pieces were in place, it didn’t take long for our data teams to benefit from the new tools at their disposal. For one, answering the very simple, yet important, question “Why isn’t my data asset updating?” is now a self-serve, at-a-glance feature: The automation tab indicates exactly why or why not a given asset is being queued up for materialization Empowered by Dagster's asset definition pages, asset owners now seamlessly manage the lifecycles of their data assets, from backfilling to incremental updates. This interface provides comprehensive, real-time insights into every activity related to an asset. One asset owner has been quoted as enjoying the UI so much that they feel confident doing things like “launching backfills from my phone.” (We don’t recommend trying this at home) The lineage view allows anyone to quickly determine table landing times and identify blockages that prevent downstream execution. Data quality is at the heart of this new system — our engineers can now write point-in-time quality checks that can be tuned to “warn,” or even “block,” downstream runs on failure. This allows us to quickly catch, alert, and fix issues before impacting critical downstream use cases like company dashboards. We alert our table owners by utilizing a notification system called DAN (Data Asset Notifications) that informs users of table failures via a Discord app . (Who uses email nowadays?) On the dbt side, we’ve been able to standardize complex metric calculations using macros , which has played a key role in removing discrepancies across the business and streamlined the way data practitioners are transforming and consuming data. To boost developer productivity, we created an internal suite of custom dbt CLI commands One of these, dubbed autogen-schema, automatically generates the boilerplate dbt YAML files a new model requires, which can often be verbose when creating from scratch. We also implemented a robust CI/CD process to prevent disruptive changes across table logic, macros, dbt tests, and more. Our advanced dbt table configurations and custom materializations are tailored to meet business demands while effortlessly integrating with our Dagster orchestration system and maintaining parity with the previous Derived system. Last but not least, we were able to leverage and contribute to the wide range of dbt packages, such as great-expectations and elementary , to quickly enable new features and functionality in our project. Where we’ve arrived post-Derived Today, our new system (internally referred to as “Transformation 2.0,” or “T2”) powers over 2000 dbt tables, covered by over 12000 dbt tests. On a typical day we will see roughly ~4000 materializations automatically triggered across both hourly and daily assets. Our migration effort has seen petabytes of data churned through as we’ve moved off of Derived and onto Transformation 2.0. A typical 6-hour overview of our system in its current state As Dagster continues to evolve, our data producers and consumers have been able to take advantage of new functionality, including column level lineage and other catalog-like features, that accentuate data discovery. We have strong conviction that Dagster will be the heart of many of Discord’s future Data Platform developments, and hope to soon open up the platform to be the place for orchestration at Discord. We greatly appreciate our partners over at Dagster, and we’re looking forward to staying on the cutting edge of orchestration with their support! If you’re interested in working on technologies like those mentioned today ( without launching backfills from your phone), be sure to check out our open roles on Discord’s mighty Data Platform team and others at our jobs page . Zach Bluhm Engineering manager on Discord’s Data Platform. Big data enjoyer. related articles . Search",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "architecture_patterns"
+    ]
+  },
+  {
+    "url": "https://discord.com/blog/developing-rapidly-with-generative-ai",
+    "title": "Developing Rapidly with Generative AI",
+    "source_name": "Discord Engineering",
+    "text": "Engineering & Developers Shannon Phu April 12, 2024 Generative AI is attracting attention as the technology has progressed in leaps and bounds in recent years, offering fresh ways to solve user problems. Since it's a relatively new area in terms of its practical application, figuring out how to start building with LLMs (large language models) can be challenging. We're excited to share our approach for solving problems with generative AI, along with insights on rapidly launching new features leveraging this technology. We break down the process of building with LLMs into a few stages. Starting with product ideation and defining requirements, we first need to figure out what we’re building and how it can benefit users. Next, we develop a prototype of our idea, learn from small-scale experiments, and repeat that process until our feature is in a good state. Finally, we fully launch and deploy our product at scale. In this post, we will dive deeper into each stage of this process. The different stages of building an LLM-powered feature How we identify use cases for generative AI We start by having empathy for our users and for our staff - what are the opportunities that generative AI can help address? Like machine learning in general, generative AI is a tool — and one that shouldn’t be applied when other tools are a better fit. When it comes to identifying where generative AI can make an impact, we dig into challenges that commonly: Involve analysis, interpretation, or review of unstructured content (e.g. text) at scale Require massive scaling that may be otherwise prohibitive due to limited resources Would be challenging for rules-based or traditional ML approaches Defining product requirements Once we've identified a potential use case for a generative AI application, the next step involves defining the product requirements. This phase requires a thoughtful analysis to select the best-suited LLM and to frame our problem as a prompt to an LLM. We consider these aspects of our problem: Latency : How fast does the system need to respond to user input? Task Complexity : What level of understanding is required from the LLM? Is the input context and prompt super domain-specific? Prompt Length : How much context needs to be provided for the LLM to do its task? Quality : What is the acceptable level of accuracy for the generated content? Safety : How important is it to sanitize user input or prevent the generation of harmful content and prompt hacking ? Language Support : Which languages does the application need to support? Estimated QPS : What throughput does our system eventually need to handle? Several factors, such as complexity, prompt length, and quality, often conflict with the need for low latency, primarily because a bigger, more capable LLM usually delivers better outcomes but operates more slowly during inference owing to the model’s larger size. Consequently, if minimizing response time is critical, we can consider either incurring higher costs (e.g. by having more available compute) or accepting a drop in quality by using smaller models. Prototyping AI applications: From Idea to MVP The product requirements we define then play into our selection of which off-the-shelf LLM we'll use for our prototype. We generally lean towards picking more advanced commercial LLMs to quickly validate our ideas and obtain early feedback from users. Although they may be expensive, the general idea is that if problems can't be adequately solved with state-of-the-art foundational models like GPT-4, then more often than not, those problems may not be addressable using current generative AI tech. If an off-the-shelf LLM can address our problem, then we can step into the learning stage and concentrate on iterating on our product rather than diverting engineering resources towards building and maintaining machine learning infrastructure. Evaluating Prompts The key step at this stage is to create the right prompt. We start with a basic prompt that tells ChatGPT (or whatever LLM we selected for our prototype) what we want it to do. Then, we make adjustments to this prompt, changing the wording to make the task clearer. However, after a lot of adjustments, it's often difficult to tell if these changes are actually improving our results. That's where evaluating the prompts becomes crucial. By using metrics to guide our changes, we know we are moving the needle on the quality of our results. To do this, we employ a technique known as AI-assisted evaluation , alongside traditional metrics for measuring performance. This helps us pick the prompts that lead to better quality outputs, making the end product more appealing to users. AI-assisted evaluation uses best-in-class LLMs (like GPT-4) to automatically critique how well the AI's outputs match what we expected or how they score against a set of criteria. This method uses GPT-4 in a way that’s similar to the critic model found in the actor-critic algorithm in reinforcement learning where a separate model is used to evaluate how well the model used for inference performed. Automating evaluation allows us to quickly see what's working well and what needs to be tweaked in our prompts, without having to manually check everything. When evaluating, we design prompts that ask for simple yes or no answers or rate the outputs on a scale, making the evaluation process straightforward. AI-assisted evaluation consists of 2 separate prompts: one for your task and another to evaluate your results. The task prompt is passed to the inference model whereas the critic prompt is passed to the more advanced critic model. Launch and Learn Once we are sufficiently confident in the quality of the results our prompt generates, we roll out a limited release (e.g. A/B test) of our product and observe the system’s performance in situ. The exact metrics we use depend on the application — our main goal is to understand how users use the feature and quickly make improvements to better meet their needs. For internal applications, this might mean measuring efficiency and sentiment. For consumer-facing applications, we similarly focus on measures of user satisfaction - direct user feedback, user engagement measures, etc. This feedback is critical to identify areas for improvement, including highlighting incorrect answers or instances where LLM hallucinations might be causing a strange user experience. Beyond user satisfaction, we also pay attention to system health metrics, such as response speed (latency), throughput (tokens per second), and error rates. LLMs sometimes have trouble generating output in a consistently structured format, which is crucial for minimizing data parsing errors and ensuring the output is robustly usable in our services. Insights here can inform how much post-hoc processing might be needed to fully productionize this capability at scale. Keeping an eye on costs is equally important for understanding how much we will spend when we fully scale up the feature. We look at how many tokens per second we're using in our initial limited release to predict the costs of a complete launch if we were to use the same technology that’s powering our prototype. All of the above information is critical to understanding if our product is working as intended and providing value to users. If it is, then we can proceed to the next step: deploying at scale. If not, then we look to take our learnings, iterate on the system, and try again. Deploying at Scale LLM Application Architecture A high-level architecture for an LLM application The basic setup for apps using LLMs consists of several essential parts. Inputs to the inference server are prepared into a prompt that we’ve tested and evaluated on a robust set of examples. At the heart of the architecture lies the LLM inference server, tasked with the job of operating the LLM to produce answers from the inputs it gets. Examples of such servers commercially include ChatGPT or other OpenAI GPT APIs, which are specialized in generating content with low latency. Because we care deeply about the user experience, privacy, and safety, we work with cross-functional partners like Legal and other Safety teams to ensure we’ve implemented thoughtful mitigations, while adhering to privacy principles such as data minimization. For example, we chose to incorporate content safety filters to the output of the inference server to identify undesired material before it reaches the user. We can leverage in-house or third-party trust and safety ML models to detect inappropriate content. All these elements put together form a system that taps into the capabilities of LLMs efficiently while monitoring the content's quality and safety to ensure that we’re delivering a quality end product. Self-hosted LLMs When we're thinking about adding a feature that uses LLMs, we consider many tradeoffs when designing our LLM inference server such as balancing the costs and the amount of engineering effort. Using commercial LLMs is great because it gives us access to top-notch models and we don't have to worry about setting up the tech ourselves, but the expenses can add up quickly. For privacy reasons, we may also prefer to process full-scale data completely in-house. A solution is to self-host an open-sourced or custom fine-tuned LLM. Opting for a self-hosted model can reduce costs dramatically - but with additional development time, maintenance overhead, and possible performance implications. Considering self-hosted solutions requires weighing these different trade-offs carefully. Recent open-source models, like Llama and Mistral , are making high-quality results possible right out of the gate, even for complex tasks that traditionally required a model to be trained specifically for them. However, for domain-specific or complex tasks, we might still need to fine-tune the model to achieve excellent performance. We've found it's best to start with smaller models and only move up to bigger ones if needed for quality reasons. Setting up the necessary machine learning infrastructure to run these big models is another challenge. We need a dedicated model server for running model inference (using frameworks like Triton or vLLM ), powerful GPUs to run everything robustly, and configurability in our servers to make sure they're high throughput and low latency. Tuning the inference servers for optimal performance is task-specific - the best configuration depends on the models we’re using, as well as the input and output token lengths, and ultimately impacts how efficiently the server can batch input requests to maximize throughput. Self-hosted inference server Closing Thoughts Looking ahead, there’s little doubt that generative AI will only grow more important as a means of solving massive-scale business-critical problems. Balancing cost, engineering effort, and performance will remain challenging, and we’re excited to see (and contribute to) the rapid development of novel technology and tools to more effectively do so in the coming years! Shannon Phu Senior Machine Learning Engineer, Applied Machine Learning. related articles . Search",
+    "quality_score": 8,
+    "modules": [
+      "ai_assisted",
+      "integration",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/cloudflare-incident-on-june-20-2024/",
+    "title": "Cloudflare incident on June 20, 2024",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-06-26 10 min read On Thursday, June 20, 2024, two independent events caused an increase in latency and error rates for Internet properties and Cloudflare services that lasted 114 minutes. During the 30-minute peak of the impact, we saw that 1.4 - 2.1% of HTTP requests to our CDN received a generic error page, and observed a 3x increase for the 99th percentile Time To First Byte (TTFB) latency. These events occurred because: Automated network monitoring detected performance degradation, re-routing traffic suboptimally and causing backbone congestion between 17:33 and 17:50 UTC A new Distributed Denial-of-Service (DDoS) mitigation mechanism deployed between 14:14 and 17:06 UTC triggered a latent bug in our rate limiting system that allowed a specific form of HTTP request to cause a process handling it to enter an infinite loop between 17:47 and 19:27 UTC Impact from these events were observed in many Cloudflare data centers around the world. With respect to the backbone congestion event, we were already working on expanding backbone capacity in the affected data centers, and improving our network mitigations to use more information about the available capacity on alternative network paths when taking action. In the remainder of this blog post, we will go into more detail on the second and more impactful of these events. As part of routine updates to our protection mechanisms, we created a new DDoS rule to prevent a specific type of abuse that we observed on our infrastructure. This DDoS rule worked as expected, however in a specific suspect traffic case it exposed a latent bug in our existing rate-limiting component. To be absolutely clear, we have no reason to believe this suspect traffic was intentionally exploiting this bug, and there is no evidence of a breach of any kind. We are sorry for the impact and have already made changes to help prevent these problems from occurring again. Background Rate-limiting suspicious traffic Depending on the profile of an HTTP request and the configuration of the requested Internet property, Cloudflare may protect our network and our customer’s origins by applying a limit to the number of requests a visitor can make within a certain time window. These rate limits can activate through customer configuration or in response to DDoS rules detecting suspicious activity. Usually, these rate limits will be applied based on the IP address of the visitor. As many institutions and Internet Service Providers (ISPs) can have many devices and individual users behind a single IP address , rate limiting based on the IP address is a broad brush that can unintentionally block legitimate traffic. Balancing traffic across our network Cloudflare has several systems that together provide continuous real-time capacity monitoring and rebalancing to ensure we serve as much traffic as we can as quickly and efficiently as we can. The first of these is Unimog, Cloudflare’s edge load balancer . Every packet that reaches our anycast network passes through Unimog, which delivers it to an appropriate server to process that packet. That server may be in a different location from where the packet originally arrived into our network, depending on the availability of compute capacity. Within each data center, Unimog aims to keep the CPU load uniform across all active servers. For a global view of our network, we rely on Traffic Manager . Across all of our data center locations, it takes in a variety of signals, such as overall CPU utilization, HTTP request latency, and bandwidth utilization to instruct rebalancing decisions. It has built-in safety limits to prevent causing outsized traffic shifts, and also considers the expected resulting load in destination locations when making any decisions. Incident timeline and impact All timestamps are UTC on 2024-06-20. 14:14 DDoS rule gradual deployment starts 17:06 DDoS rule deployed globally 17:47 First HTTP request handling process is poisoned 18:04 Incident declared automatically based on detected high CPU load 18:34 Service restart shown to recover on a server, full restart tested in one data center 18:44 CPU load normalized in data center after service restart 18:51 Continual global reloads of all servers with many stuck processes begin 19:05 Global eyeball HTTP error rate peaks at 2.1% service unavailable / 3.45% total 19:05 First Traffic Manager actions recovering service 19:11 Global eyeball HTTP error rate halved to 1% service unavailable / 1.96% total 19:27 Global eyeball HTTP error rate reduced to baseline levels 19:29 DDoS rule deployment identified as likely cause of process poisoning 19:34 DDoS rule is fully disabled 19:43 Engineers stop routine restarts of services on servers with many stuck processes 20:16 Incident response stood down Below, we provide a view of the impact from some of Cloudflare’s internal metrics. The first graph illustrates the percentage of all eyeball (inbound from external devices) HTTP requests that were served an error response because the service suffering poisoning could not be reached. We saw an initial increase to 0.5% of requests, and then later a larger one reaching as much as 2.1% before recovery started due to our service reloads. For a broader view of errors, we can see all 5xx responses our network returned to eyeballs during the same window, including those from origin servers. These peaked at 3.45%, and you can more clearly see the gradual recovery between 19:25 and 20:00 UTC as Traffic Manager finished its re-routing activities. The dip at 19:25 UTC aligns with the last large reload, with the error increase afterwards primarily consisting of upstream DNS timeouts and connection limits which are consistent with high and unbalanced load. And here’s what our TTFB measurements looked like at the 50th, 90th and 99th percentiles, showing an almost 3x increase in latency at p99: Technical description of the error and how it happened Global percentage of HTTP Request handling processes that were using excessive CPU during the event Earlier on June 20, between 14:14 - 17:06 UTC, we gradually activated a new DDoS rule on our network. Cloudflare has recently been building a new way of mitigating HTTP DDoS attacks. This method is using a combination of rate-limits and cookies in order to allow legitimate clients that were falsely identified as being part of an attack to proceed anyway. With this new method, an HTTP request that is considered suspicious runs through these key steps: Check for the presence of a valid cookie, otherwise block the request If a valid cookie is found, add a rate-limit rule based on the cookie value to be evaluated at a later point Once all the currently applied DDoS mitigation are run, apply rate-limit rules We use this \"asynchronous\" workflow because it is more efficient to block a request without a rate-limit rule, so it gives a chance for other rule types to be applied. So overall, the flow can be summarized with this pseudocode: for (rule in active_mitigations) { // ... (ignore other rule types) if (rule.match_current_request()) { if (!has_valid_cookie()) { // no cookie: serve error page return serve_error_page(); } else { // add a rate-limit rule to be evaluated later add_rate_limit_rule(rule); } } } evaluate_rate_limit_rules(); When evaluating rate-limit rules, we need to make a key for each client that is used to look up the correct counter and compare it with the target rate. Typically, this key is the client IP address, but other options are available, such as the value of a cookie as used here. We actually reused an existing portion of the rate-limit logic to achieve this. In pseudocode, it looks like: function get_cookie_key() { // Validate that the cookie is valid before taking its value. // Here the cookie has been checked before already, but this code is // also used for \"standalone\" rate-limit rules. if (!has_valid_cookie_broken()) { // more on the \"broken\" part later return cookie_value; } else { return parent_key_generator(); } } This simple key generation function had two issues that, combined with a specific form of client request, caused an infinite loop in the process handling the HTTP request: The rate-limit rules generated by the DDoS logic are using internal APIs in ways that haven't been anticipated. This caused the parent_key_generator in the pseudocode above to point to the get_cookie_key function itself, meaning that if that code path was taken, the function would call itself indefinitely As these rate-limit rules are added only after validating the cookie, validating it a second time should give the same result. The problem is that the has_valid_cookie_broken function used here is actually different and both can disagree if the client sends multiple cookies where some are valid but not others So, combining these two issues: the broken validation function tells get_cookie_key that the cookie is invalid, causing the else branch to be taken and calling the same function over and over. A protection many programming languages have in place to help prevent loops like this is a run-time protection limit on how deep the stack of function calls can get. An attempt to call a function once already at this limit will result in a runtime error. When reading the logic above, an initial analysis might suggest we were reaching the limit in this case, and so requests eventually resulted in an error, with a stack containing those same function calls over and over. However, this isn’t the case here. Some languages, including Lua, in which this logic is written, also implement an optimization called proper tail calls. A tail call is when the final action a function takes is to execute another function. Instead of adding that function as another layer in the stack, as we know for sure that we will not be returning execution context to the parent function afterwards, nor using any of its local variables, we can replace the top frame in the stack with this function call instead. The end result is a loop in the request processing logic which never increases the size of the stack. Instead, it simply consumes 100% of available CPU resources, and never terminates. Once a process handling HTTP requests receives a single request on which the action should be applied and has a mixture of valid and invalid cookies, that process is poisoned and is never able to process any further requests. Every Cloudflare server has dozens of such processes, so a single poisoned process does not have much of an impact. However, then some other things start happening: The increase in CPU utilization for the server causes Unimog to lower the amount of new traffic that server receives, moving traffic to other servers, so at a certain point, more new connections are directed away from servers with a subset of their processes poisoned to those with fewer or no poisoned processes, and therefore lower CPU utilization. The gradual increase in CPU utilization in the data center starts to cause Traffic Manager to redirect traffic to other data centers. As this movement does not fix the poisoned processes, CPU utilization remains high, and so Traffic Manager continues to redirect more and more traffic away. The redirected traffic in both cases includes the requests that are poisoning processes, causing the servers and data centers to which this redirected traffic was sent to start failing in the same way. Within a few minutes, multiple data centers had many poisoned processes, and Traffic Manager had redirected as much traffic away from them as possible, but was restricted from doing more. This was partly due to its built-in automation safety limits, but also because it was becoming more difficult to find a data center with sufficient available capacity to use as a target. The first case of a poisoned process was at 17:47 UTC, and by 18:09 UTC – five minutes after the incident was declared – Traffic Manager was re-routing a lot of traffic out of Europe: A summary map of Traffic Manager capacity actions as of 18:09 UTC. Each circle represents a data center that traffic is being re-routed towards or away from. The color of the circle indicates the CPU load of that data center. The orange ribbons between them show how much traffic is re-routed, and where from/to. It’s obvious to see why, if we look at the percentage of the HTTP request service’s processes that were saturating their CPUs. 10% of our capacity in Western Europe was already gone, and 4% in Eastern Europe, during peak traffic time for those timezones: Percentage of all the HTTP request handling processes saturating their CPU, by geographic region Partially poisoned servers in many locations struggled with the request load, and the remaining processes could not keep up, resulting in Cloudflare returning minimal HTTP error responses. Cloudflare engineers were automatically notified at 18:04 UTC, once our global CPU utilization reached a certain sustained level, and started to investigate. Many of our on-duty incident responders were already working on the open incident caused by backbone network congestion, and in the early minutes we looked into likely correlation with the network congestion events. It took some time for us to realize that locations where the CPU was highest is where traffic was the lowest, drawing the investigation away from a network event being the trigger. At this point, the focus moved to two main streams: Evaluating if restarting poisoned processes allowed them to recover, and if so, instigating mass-restarts of the service on affected servers Identifying the trigger of processes entering this CPU saturation state It was 25 minutes after the initial incident was declared when we validated that restarts helped on one sample server. Five minutes after this, we started executing wider restarts – initially to entire data centers at once, and then as the identification method was refined, on servers with a large number of poisoned processes. Some engineers continued regular routine restarts of the affected service on impacted servers, whilst others moved to join the ongoing parallel effort to identify the trigger. At 19:36 UTC, the new DDoS rule was disabled globally, and the incident was declared resolved after executing one more round of mass restarts and monitoring. At the same time, conditions presented by the incident triggered a latent bug in Traffic Manager. When triggered, the system would attempt to recover from the exception by initiating a graceful restart, halting its activity. The bug was first triggered at 18:17 UTC, then numerous times between 18:35 and 18:57 UTC. During two periods in this window (18:35-18:52 UTC and 18:56-19:05 UTC) the system did not issue any new traffic routing actions. This meant whilst we had recovered service in the most affected data centers, almost all traffic was still being re-routed away from them. Alerting notified on-call engineers of the issue at 18:34 UTC. By 19:05 UTC the Traffic team had written, tested, and deployed a fix. The first actions following restoration showed a positive impact on restoring service. To resolve the immediate impact to our network from the request poisoning, Cloudflare instigated mass rolling restarts of the affected service until the change that triggered the condition was identified and rolled back. The change, which was the activation of a new type of DDoS rule, remains fully rolled back, and the rule will not be reactivated until we have fixed the broken cookie validation check and are fully confident this situation cannot recur. We take these incidents very seriously, and recognize the magnitude of impact they had. We have identified several steps we can take to address these specific situations, and the risk of these sorts of problems from recurring in the future. Design: The rate limiting implementation in use for our DDoS module is a legacy component, and rate limiting rules customers configure for their Internet properties use a newer engine with more modern technologies and protections. Design: We are exploring options within and around the service which experienced process poisoning to limit the ability to loop forever through tail calls. Longer term, Cloudflare is entering the early implementation stages of replacing this service entirely. The design of this replacement service will allow us to apply limits on the non-interrupted and total execution time of a single request. Process: The activation of the new rule for the first time was staged in a handful of production data centers for validation, and then to all data centers a few hours later. We will continue to enhance our staging and rollout procedures to minimize the potential change-related blast radius. Conclusion Cloudflare experienced two back-to-back incidents that affected a significant set of customers using our CDN and network services. The first was network backbone congestion that our systems automatically remediated. We mitigated the second by regularly restarting the faulty service whilst we identified and deactivated the DDoS rule that was triggering the fault. We are sorry for any disruption this caused our customers and to end users trying to access services. The conditions necessary to activate the latent bug in the faulty service are no longer possible in our production environment, and we are putting further fixes and detections in place as soon as possible. Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Post Mortem Outage",
+    "quality_score": 9,
+    "modules": [
+      "error_resilience",
+      "observability",
+      "security"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/adopting-opentelemetry-for-our-logging-pipeline/",
+    "title": "Adopting OpenTelemetry for our logging pipeline",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-06-03 8 min read Cloudflare’s logging pipeline is one of the largest data pipelines that Cloudflare has, serving millions of log events per second globally, from every server we run. Recently, we undertook a project to migrate the underlying systems of our logging pipeline from syslog-ng to OpenTelemetry Collector and in this post we want to share how we managed to swap out such a significant piece of our infrastructure, why we did it, what went well, what went wrong, and how we plan to improve the pipeline even more going forward. Background A full breakdown of our existing infrastructure can be found in our previous post An overview of Cloudflare's logging pipeline , but to quickly summarize here: We run a syslog-ng daemon on every server, reading from the local systemd-journald journal, and a set of named pipes. We forward those logs to a set of centralized “log-x receivers”, in one of our core data centers. We have a dead letter queue destination in another core data center, which receives messages that could not be sent to the primary receiver, and which get mirrored across to the primary receivers when possible. The goal of this project was to replace those syslog-ng instances as transparently as possible. That means we needed to implement all these behaviors as precisely as possible, so that we didn’t need to modify any downstream systems. There were a few reasons for wanting to make this shift, and enduring the difficulties of overhauling such a large part of our infrastructure: syslog-ng is written in C, which is not a core competency of our team. While we have made upstream contributions to the project in the past, and the experience was great, having the OpenTelemetry collector in Go allows much more of our team to be able to contribute improvements to the system. Building syslog-ng against our internal Post-Quantum cryptography libraries was difficult, due to having to maintain an often brittle C build chain, whereas our engineering teams have optimized the Go build model to make this as simple as possible. OpenTelemetry Collectors have built in support for Prometheus metrics, which allows us to gather much deeper levels of telemetry data around what the collectors are doing, and surface these insights as “meta-observability” to our engineering teams. We already use OpenTelemetry Collectors for some of our tracing infrastructure, so unifying onto one daemon rather than having separate collectors for all our different types of telemetry reduces the cognitive load on the team. The Migration Process What we needed to build While the upstream contrib repository contains a wealth of useful components, all packaged into its own distribution, it became clear early on that we would need our own internal components. Having our own internal components would require us to build our own distribution, so one of the first things we did was turn to OCB (OpenTelemetry Collector Builder) to provide us a way to build an internal distribution of an OpenTelemetry Collector. We eventually ended up templating our OCB configuration file to automatically include all the internal components we have built, so that we didn’t have to add them manually. In total, we built four internal components for our initial version of the collector. cfjs1exporter Internally, our logging pipeline uses a line format we call “cfjs1”. This format describes a JSON encoded log, with two fields: a format field, that decides the type of the log, and a “wrapper” field which contains the log body (which is a structured JSON object in and of itself), with a field name that changes depending on the format field. These two fields decide which Kafka topic our receivers will end up placing the log message in. Because we didn’t want to make changes to other parts of the pipeline, we needed to support this format in our collector. To do this, we took inspiration from the contrib repository’s syslogexporter , building our cfjs1 format into it. Ultimately, we would like to move towards using OTLP (OpenTelemetry Protocol) as our line format. This would allow us to remove our custom exporter, and utilize open standards, enabling easier migrations in the future. fileexporter While the upstream contrib repo does have a file exporter component, it only supports two formats: JSON and Protobuf. We needed to support two other formats, plain text and syslog, so we ended up forking the file exporter internally. Our plain text formatter simply outputs the body of the log message into a file, with newlines as a delimiter. Our syslog format outputs RFC 5424 formatted syslog messages into a file. The other feature we implemented on our internal fork was custom permissions. The upstream file exporter is a bit of a mess, in that it actually has two different modes of operation – a standard mode, not utilizing any of the compression or rotation features, and a more advanced mode which uses those features. Crucially, if you want to use any of the rotation features, you end up using lumberjack , whereas without those features you use a more native file handling. This leads to strange issues where some features of the exporter are supported in one mode, but not the other. In the case of permissions, the community seems open to the idea in the native handling, but lumberjack seems against the idea . This dichotomy is what led us to implement it ourselves internally. Ultimately, we would love to upstream these improvements should the community be open to them. Having support for custom marshallers ( https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/30331 ) would have made this a bit easier, however it’s not clear how that would work with OCB. Either that, or we could open source them in the Cloudflare organization , but we would love to remove the need to maintain our own fork in the future. externaljsonprocessor We want to set the value of an attribute/field that comes from external sources: either from an HTTP endpoint or an output from running a specific command. In syslog-ng, we have a sidecar service that generates a syslog-ng configuration to achieve this. In replacing syslog-ng with our OpenTelemetry Collector, we thought it would be easier to implement this feature as a custom component of our collector instead. To that end, we implemented an “external JSON processor”, which is able to periodically query external data sources and add those fields to all the logs that flow through the processor. Cloudflare has many internal tools and APIs, and we use this processor to fetch data like the status of a data center, or the status of a systemd unit. This enables our engineers to have more filtering options, such as to exclude logs from data centers that are not supposed to receive customer traffic, or servers that are disabled for maintenance. Crucially, this allows us to update these values much faster than the standard three-hour cadence of other configuration updates through salt, allowing more rapid updates to these fields that may change quickly as we operate our network. ratelimit processor The last component we needed to implement was a replacement for the syslog-ng ratelimit filter , also contributed by us upstream. The ratelimit filter allows applying rate limits based on a specific field of a log message, dropping messages that exceed some limit (with an optional burst limit). In our case, we apply rate limits over the service field, ensuring that no individual service can degrade the log collection for any other. While there has been some upstream discussion of similar components , we couldn’t find anything that explicitly fit our needs. This was especially true when you consider that in our case the data loss during the rate limiting process is intentional, something that might be hard to sell when trying to build something more generally applicable. How we migrated Once we had an OpenTelemetry Collector binary, we had to deploy it. Our deployment process took two forks: Deploying to our core data centers, and deploying to our edge data centers. For those unfamiliar, Cloudflare’s core data centers contain a small number of servers with a very diverse set of workloads, from Postgresql, to ElasticSearch, to Kubernetes, and everything in between. Our edge data centers, on the other hand, are much more homogenous. They contain a much larger number of servers, each one running the same set of services. Both edge and core use salt to configure the services running on their servers. This meant that the first step was to write salt states that would install the OpenTelemetry collector, and write the appropriate configurations to disk. Once we had those in place, we also needed to write some temporary migration pieces that would disable syslog-ng and start the OpenTelemetry collector, as well as the inverse in the case of a roll back. For the edge data centers, once we had a set of configurations written, it mostly came down to rolling the changes out gradually across the edge servers. Because edge servers run the same set of services, once we had gained confidence in our set of configurations, it became a matter of rolling out the changes slowly and monitoring the logging pipelines along the way. We did have a few false starts here, and needed to instrument our cfjs1exporter a bit more to work around issues surrounding some of our more niche services and general Internet badness which we’ll detail below in our lessons learned. The core data centers required a more hands-on approach. Many of our services in core have custom syslog-ng configurations. For example, our Postgresql servers have custom handling for their audit logs, and our Kubernetes servers have custom handling for contour ingress and error logs. This meant that each role with a custom config had to be manually onboarded, with extensive testing on the designated canary nodes of each role to validate the configurations. Lessons Learned Failover At Cloudflare, we regularly schedule chaos testing on our core data centers which contain our centralized log receivers. During one of these chaos tests, our cfjs1 exporter did not notice that it could not send to the primary central logging server. This caused our collector to not failover to the secondary central logging server and its log buffer to fill up, which resulted in the collector failing to consume logs from its receivers. This is not a problem with journal receivers since logs are buffered by journald before they get consumed by the collector, but it is a different case with named pipe receivers. Due to this bug, our collectors stopped consuming logs from named pipes, and services writing to these named pipes started blocking threads waiting to write to them. Our syslog-ng deployment solved this issue using a monit script to periodically kill the connections between syslog-ng and the central receivers, however we opted to solve this more explicitly in our exporter by building in much tighter timeouts, and modifying the upstream failover receiver to better respond to these partial failures. Cutover delays As we’ve previously blogged about , at Cloudflare, we use Nomad for running dynamic tasks in our edge data centers. We use a custom driver to run containers and this custom driver handles the shipping of logs from the container to a named pipe. We did the migration from syslog-ng to OpenTelemetry Collectors while servers were live and running production services. During the migration, there was a gap when syslog-ng was stopped by our configuration management and our OpenTelemetry collector was started on the server. This gap caused the logs in the named pipe to not get consumed and similar to the previous named pipe, the services writing to the named pipe receiver in blocking mode got affected. Similar to NGINX and Postgresql, Cloudflare’s driver for Nomad also writes logs to the named pipe driver in blocking mode. Because of this delay, the driver timed out sending logs and rescheduled the containers. We ultimately caught this pretty early on in testing, and changed our approach to the rollout. Instead of using Salt to separately stop syslog-ng and start the collector, we instead used salt to schedule a systemd “one shot” service that simultaneously stopped syslog-ng and started the collector, minimizing the downtime between the two. What’s next? Migrating such a critical part of our infrastructure is never easy, especially when it has remained largely untouched for nearly half a decade. Even with the issues we hit during our rollout, migrating to an OpenTelemetry Collector unlocks so many more improvements to our logging pipeline going forward. With the initial deployment complete, there are a number of changes we’re excited to work on next, including: Better handling for log sampling, including tail sampling Better insights for our engineering teams on their telemetry production Migration to OTLP as our line protocol Upstreaming of some of our custom components If that sounds interesting to you, we’re hiring engineers to come work on our logging pipeline , so please reach out! Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Observability Engineering",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/reclaiming-cpu-for-free-with-pgo/",
+    "title": "Reclaiming CPU for free with Go's Profile Guided Optimization",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-05-14 4 min read Golang 1.20 introduced support for Profile Guided Optimization (PGO) to the go compiler. This allows guiding the compiler to introduce optimizations based on the real world behaviour of your system. In the Observability Team at Cloudflare, we maintain a few Go-based services that use thousands of cores worldwide, so even the 2-7% savings advertised would drastically reduce our CPU footprint, effectively for free. This would reduce the CPU usage for our internal services, freeing up those resources to serve customer requests, providing measurable improvements to our customer experience. In this post, I will cover the process we created for experimenting with PGO – collecting representative profiles across our production infrastructure and then deploying new PGO binaries and measuring the CPU savings. How does PGO work? PGO itself is not a Go-specific tool, although it is relatively new. PGO allows you to take CPU profiles from a program running in production and use that to optimise the generated assembly for that program. This includes a bunch of different optimisations such as inlining heavily used functions more aggressively, reworking branch prediction to favour the more common branches, and rearranging the generated code to lump hot paths together to save on CPU cache swapping. The general flow for using PGO is to compile a non-PGO binary and deploy it to production, collect CPU profiles from the binary in production, and then compile a second binary using that CPU profile. CPU Profiles contain samples of what the CPU was spending the most time on when executing a program, which provides valuable context to the compiler when it’s making decisions about optimising a program. For example, the compiler may choose to inline a function that is called many times to reduce the function call overhead, or it might choose to unroll a particularly jump-heavy loop. Crucially, using a profile from production can guide the compiler much more efficiently than any upfront heuristics. A practical example In the Observability team, we operate a system we call “wshim”. Wshim is a service that runs on every one of our edge servers, providing a push gateway for telemetry sourced from our internal Cloudflare Workers. Because this service runs on every server, and is called every time an internal worker is called, wshim requires a lot of CPU time to run. In order to track exactly how much, we put wshim into its own cgroup , and use cadvisor to expose Prometheus metrics pertaining to the resources that it uses. Before deploying PGO, wshim was using over 3000 cores globally: container_cpu_time_seconds is our internal metric that tracks the amount of time a CPU has spent running wshim across the world. Even a 2% saving would return 60 cores to our customers, making the Cloudflare network even more efficient. The first step in deploying PGO was to collect representative profiles from our servers worldwide. The first problem we run into is that we run thousands of servers, each with different usage patterns at given points in time – a datacenter serving lots of requests during daytime hours will have a different usage pattern than a different data center that locally is in the middle of the night. As such, selecting exactly which servers to profile is paramount to collecting good profiles for PGO to use. In the end, we decided that the best samples would be from those datacenters experiencing heavy load – those are the ones where the slowest parts of wshim would be most obvious. Even further, we will only collect profiles from our Tier 1 data centers. These are data centers that serve our most heavily populated regions, are generally our largest, and are generally under very heavy loads during peak hours. Concretely, we can get a list of high CPU servers by querying our Thanos infrastructure: num_profiles=\"1000\" # Fetch the top n CPU users for wshim across the edge using Thanos. cloudflared access curl \"https://thanos/api/v1/query?query=topk%28${num_profiles}%2Cinstance%3Acontainer_cpu_time_seconds_total%3Arate2m%7Bapp_name%3D%22wshim.service%22%7D%29&dedup=true&partial_response=true\" --compressed | jq '.data.result[].metric.instance' -r > \"${instances_file}\" Go makes actually fetching CPU profiles trivial with pprof . In order for our engineers to debug their systems in production, we provide a method to easily retrieve production profiles that we can use here. Wshim provides a pprof interface that we can use to retrieve profiles, and we can collect these again with bash: # For every instance, attempt to pull a CPU profile. Note that due to the transient nature of some data centers # a certain percentage of these will fail, which is fine, as long as we get enough nodes to form a representative sample. while read instance; do fetch-pprof $instance –port 8976 –seconds 30' > \"${working_dir}/${instance}.pprof\" & done < \"${instances_file}\" wait $(jobs -p) And then merge all the gathered profiles into one, with go tool: # Merge the fetched profiles into one. go tool pprof -proto \"${working_dir}/\"*.pprof > profile.pprof It’s this merged profile that we will use to compile our pprof binary. As such, we commit it to our repo so that it lives alongside all the other deployment components of wshim: ~/cf-repos/wshim ± master 23/01/2024 10:49:08 AEDT❯ tree pgo pgo ├── README.md ├── fetch-profiles.sh └── profile.pprof And update our Makefile to pass in the -pgo flag to the go build command: build: go build -pgo ./pgo/profile.pprof -o /tmp/wshim ./cmd/wshim After that, we can build and deploy our new PGO optimized version of wshim, like any other version. Results Once our new version is deployed, we can review our CPU metrics to see if we have any meaningful savings. Resource usages are notoriously hard to compare. Because wshim’s CPU usage scales with the amount of traffic that any given server is receiving, it has a lot of potentially confounding variables, including the time of day, day of the year, and whether there are any active attacks affecting the datacenter. That being said, we can take a couple of numbers that might give us a good indication of any potential savings. Firstly, we can look at the CPU usage of wshim immediately before and after the deployment. This may be confounded by the time difference between the sets, but it shows a decent improvement. Because our release takes just under two hours to roll to every tier 1 datacenter, we can use PromQLs `offset` operator to measure the difference: This indicates that following the release, we’re using ~97 cores fewer than before the release, a ~3.5% reduction. This seems to be inline with the upstream documentation that gives numbers between 2% and 14%. The second number we can look at is the usage at the same time of day on different days of the week. The average usage for the 7 days prior to the release was 3067.83 cores, whereas the 7 days after the release were 2996.78, a savings of 71 CPUs. Not quite as good as our 97 CPU savings, but still pretty substantial! This seems to prove the benefits of PGO – without changing the code at all, we managed to save ourselves several servers worth of CPU time. Future work Looking at these initial results certainly seems to prove the case for PGO – saving multiple servers worth of CPU without any code changes is a big win for freeing up resources to better serve customer requests. However, there is definitely more work to be done here. In particular: Automating the collection of profiles, perhaps using continuous profiling Refining the deployment process to handle the new “two-step deployment”, deploying a non PGO binary, and then a PGO one Refining our techniques to derive representative profiling samples Implementing further improvements with BOLT , or other Link Time Optimization (LTO) techniques If that sounds interesting to you, we’re hiring in both the USA and EMEA ! Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Observability Performance Related posts March 23, 2026 1:00 PM Launching Cloudflare’s Gen 13 servers: trading cache for cores for 2x edge compute performance Cloudflare’s Gen 13 servers double our compute throughput by rethinking the balance between cache and cores. Moving to high-core-count AMD EPYC ™ Turin CPUs, we traded large L3 cache for raw compute density. By running our new Rust-based FL2 stack, we completely mitigated the latency penalty to unlock twice the performance.... By February 27, 2026 6:00 AM We deserve a better streams API for JavaScript The Web streams API has become ubiquitous in JavaScript runtimes but was designed for a different era. Here's what a modern streaming API could (should?) look like.... By February 24, 2026 8:00 PM How we rebuilt Next.js with AI in one week One engineer used AI to rebuild Next.js on Vite in a week. vinext builds up to 4x faster, produces 57% smaller bundles, and deploys to Cloudflare Workers with a single command.... By February 03, 2026 2:00 PM Improve global upload performance with R2 Local Uploads Local Uploads on R2 reduces request duration for uploads by up to 75%. It writes object data to a nearby location and asynchronously copies it to your bucket, all while data is available immediately. ... By",
+    "quality_score": 8,
+    "modules": [
+      "go_patterns",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://blog.cloudflare.com/how-we-built-cloudflare-queues/",
+    "title": "Durable Objects aren't just durable, they're fast: a 10x speedup for Cloudflare Queues",
+    "source_name": "Cloudflare Blog",
+    "text": "2024-10-24 8 min read Cloudflare Queues let a developer decouple their Workers into event-driven services. Producer Workers write events to a Queue, and consumer Workers are invoked to take actions on the events. For example, you can use a Queue to decouple an e-commerce website from a service which sends purchase confirmation emails to users. During 2024’s Birthday Week, we announced that Cloudflare Queues is now Generally Available , with significant performance improvements that enable larger workloads. To accomplish this, we switched to a new architecture for Queues that enabled the following improvements: Median latency for sending messages has dropped from ~200ms to ~60ms Maximum throughput for each Queue has increased over 10x, from 400 to 5000 messages per second Maximum Consumer concurrency for each Queue has increased from 20 to 250 concurrent invocations Median latency drops from ~200ms to ~60ms as Queues are migrated to the new architecture In this blog post, we'll share details about how we built Queues using Durable Objects and the Cloudflare Developer Platform, and how we migrated from an initial Beta architecture to a geographically-distributed, horizontally-scalable architecture for General Availability. v1 Beta architecture When initially designing Cloudflare Queues, we decided to build something simple that we could get into users' hands quickly. First, we considered leveraging an off-the-shelf messaging system such as Kafka or Pulsar. However, we decided that it would be too challenging to operate these systems at scale with the large number of isolated tenants that we wanted to support. Instead of investing in new infrastructure, we decided to build on top of one of Cloudflare's existing developer platform building blocks: Durable Objects. Durable Objects are a simple, yet powerful building block for coordination and storage in a distributed system. In our initial v1 architecture, each Queue was implemented using a single Durable Object. As shown below, clients would send messages to a Worker running in their region, which would be forwarded to the single Durable Object hosted in the WNAM (Western North America) region. We used a single Durable Object for simplicity, and hosted it in WNAM for proximity to our centralized configuration API service. One of a Queue's main responsibilities is to accept and store incoming messages. Sending a message to a v1 Queue used the following flow: A client sends a POST request containing the message body to the Queues API at /accounts/:accountID/queues/:queueID/messages The request is handled by an instance of the Queue Broker Worker in a Cloudflare data center running near the client. The Worker performs authentication, and then uses Durable Objects idFromName API to route the request to the Queue Durable Object for the given queueID The Queue Durable Object persists the message to storage before returning a success back to the client. Durable Objects handled most of the heavy-lifting here: we did not need to set up any new servers, storage, or service discovery infrastructure. To route requests, we simply provided a queueID and the platform handled the rest. To store messages, we used the Durable Object storage API to put each message, and the platform handled reliably storing the data redundantly. Consuming messages The other main responsibility of a Queue is to deliver messages to a Consumer. Delivering messages in a v1 Queue used the following process: Each Queue Durable Object maintained an alarm that was always set when there were undelivered messages in storage. The alarm guaranteed that the Durable Object would reliably wake up to deliver any messages in storage, even in the presence of failures. The alarm time was configured to fire after the user's selected max wait time , if only a partial batch of messages was available. Whenever one or more full batches were available in storage, the alarm was scheduled to fire immediately. The alarm would wake the Durable Object, which continually looked for batches of messages in storage to deliver. Each batch of messages was sent to a \"Dispatcher Worker\" that used Workers for Platforms dynamic dispatch to pass the messages to the queue() function defined in a user's Consumer Worker This v1 architecture let us flesh out the initial version of the Queues Beta product and onboard users quickly. Using Durable Objects allowed us to focus on building application logic, instead of complex low-level systems challenges such as global routing and guaranteed durability for storage. Using a separate Durable Object for each Queue allowed us to host an essentially unlimited number of Queues, and provided isolation between them. However, using only one Durable Object per queue had some significant limitations: Latency: we created all of our v1 Queue Durable Objects in Western North America. Messages sent from distant regions incurred significant latency when traversing the globe. Throughput: A single Durable Object is not scalable: it is single-threaded and has a fixed capacity for how many requests per second it can process. This is where the previous 400 messages per second limit came from. Consumer Concurrency: Due to concurrent subrequest limits , a single Durable Object was limited in how many concurrent subrequests it could make to our Dispatcher Worker. This limited the number of queue() handler invocations that it could run simultaneously. To solve these issues, we created a new v2 architecture that horizontally scales across multiple Durable Objects to implement each single high-performance Queue. v2 Architecture In the new v2 architecture for Queues, each Queue is implemented using multiple Durable Objects, instead of just one. Instead of a single region, we place Storage Shard Durable Objects in all available regions to enable lower latency. Within each region, we create multiple Storage Shards and load balance incoming requests amongst them. Just like that, we’ve multiplied message throughput. Sending a message to a v2 Queue uses the following flow: A client sends a POST request containing the message body to the Queues API at /accounts/:accountID/queues/:queueID/messages The request is handled by an instance of the Queue Broker Worker running in a Cloudflare data center near the client. The Worker: Performs authentication Reads from Workers KV to obtain a Shard Map that lists available storage shards for the given region and queueID Picks one of the region's Storage Shards at random, and uses Durable Objects idFromName API to route the request to the chosen shard The Storage Shard persists the message to storage before returning a success back to the client. In this v2 architecture, messages are stored in the closest available Durable Object storage cluster near the user, greatly reducing latency since messages don't need to be shipped all the way to WNAM. Using multiple shards within each region removes the bottleneck of a single Durable Object, and allows us to scale each Queue horizontally to accept even more messages per second. Workers KV acts as a fast metadata store: our Worker can quickly look up the shard map to perform load balancing across shards. To improve the Consumer side of v2 Queues, we used a similar \"scale out\" approach. A single Durable Object can only perform a limited number of concurrent subrequests. In v1 Queues, this limited the number of concurrent subrequests we could make to our Dispatcher Worker. To work around this, we created a new Consumer Shard Durable Object class that we can scale horizontally, enabling us to execute many more concurrent instances of our users' queue() handlers. Consumer Durable Objects in v2 Queues use the following approach: Each Consumer maintains an alarm that guarantees it will wake up to process any pending messages. v2 Consumers are notified by the Queue's Coordinator (introduced below) when there are messages ready for consumption. Upon notification, the Consumer sets an alarm to go off immediately. The Consumer looks at the shard map, which contains information about the storage shards that exist for the Queue, including the number of available messages on each shard. The Consumer picks a random storage shard with available messages, and asks for a batch. The Consumer sends the batch to the Dispatcher Worker, just like for v1 Queues. After processing the messages, the Consumer sends another request to the Storage Shard to either \"acknowledge\" or \"retry\" the messages. This scale-out approach enabled us to work around the subrequest limits of a single Durable Object, and increase the maximum supported concurrency level of a Queue from 20 to 250. The Coordinator and “Control Plane” So far, we have primarily discussed the \"Data Plane\" of a v2 Queue: how messages are load balanced amongst Storage Shards, and how Consumer Shards read and deliver messages. The other main piece of a v2 Queue is the \"Control Plane\", which handles creating and managing all the individual Durable Objects in the system. In our v2 architecture, each Queue has a single Coordinator Durable Object that acts as the brain of the Queue. Requests to create a Queue, or change its settings, are sent to the Queue's Coordinator. The Coordinator maintains a Shard Map for the Queue, which includes metadata about all the Durable Objects in the Queue (including their region, number of available messages, current estimated load, etc.). The Coordinator periodically writes a fresh copy of the Shard Map into Workers KV, as pictured in step 1 of the diagram. Placing the shard map into Workers KV ensures that it is globally cached and available for our Worker to read quickly, so that it can pick a shard to accept the message. Every shard in the system periodically sends a heartbeat to the Coordinator as shown in steps 2 and 3 of the diagram. Both Storage Shards and Consumer Shards send heartbeats, including information like the number of messages stored locally, and the current load (requests per second) that the shard is handling. The Coordinator uses this information to perform autoscaling. When it detects that the shards in a particular region are overloaded, it creates additional shards in the region, and adds them to the shard map in Workers KV. Our Worker sees the updated shard map and naturally load balances messages across the freshly added shards. Similarly, the Coordinator looks at the backlog of available messages in the Queue, and decides to add more Consumer shards to increase Consumer throughput when the backlog is growing. Consumer Shards pull messages from Storage Shards for processing as shown in step 4 of the diagram. Switching to a new scalable architecture allowed us to meet our performance goals and take Queues to GA. As a recap, this new architecture delivered these significant improvements: P50 latency for writing to a Queue has dropped from ~200ms to ~60ms. Maximum throughput for a Queue has increased from 400 to 5000 messages per second. Maximum consumer concurrency has increased from 20 to 250 invocations. What's next for Queues We plan on leveraging the performance improvements in the new beta version of Durable Objects which use SQLite to continue to improve throughput/latency in Queues. We will soon be adding message management features to Queues so that you can take actions to purge messages in a queue, pause consumption of messages, or “redrive”/move messages from one queue to another (for example messages that have been sent to a Dead Letter Queue could be “redriven” or moved back to the original queue). Work to make Queues the \"event hub\" for the Cloudflare Developer Platform: Create a low-friction way for events emitted from other Cloudflare services with event schemas to be sent to Queues. Build multi-Consumer support for Queues so that Queues are no longer limited to one Consumer per queue. To start using Queues, head over to our Getting Started guide. Do distributed systems like Cloudflare Queues and Durable Objects interest you? Would you like to help build them at Cloudflare? We're Hiring! Cloudflare's connectivity cloud protects entire corporate networks , helps customers build Internet-scale applications efficiently , accelerates any website or Internet application , wards off DDoS attacks , keeps hackers at bay , and can help you on your journey to Zero Trust . Visit 1.1.1.1 from any device to get started with our free app that makes your Internet faster and safer. To learn more about our mission to help build a better Internet, start here . If you're looking for a new career direction, check out our open positions . Product News Cloudflare Queues Cloudflare Workers Durable Objects Developers Developer Platform",
+    "quality_score": 9,
+    "modules": [
+      "architecture_patterns",
+      "performance",
+      "concurrency",
+      "design_patterns"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/search/reimagining-linkedins-search-stack",
+    "title": "Reimagining LinkedIn's search tech stack",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Co-authors: Jiahao Xu , Xiaojing Ma , Sriram Vasudevan , Muchen Wu , Rachel Zheng , Benjamin Le , Shaobo Zhang , Sarang Metkar , Rupesh Gupta , Qianqi Kay Shen , Ali Hooshmand , David Nicolás Racca , Vivek Katarya , Kayhan Behdin , Igor Lapchuk , Xueying Lu , Lingyu(Claire) Zhang , Gokulraj Mohanasundaram , Juan Pablo Bottaro , Lily(Jiayu) Li , Yanbo Li , Guoyao L. , Caleb Johnson , and Sundara Raman Ramachandran At LinkedIn, our mission is to connect professionals to opportunity. Search plays a central role in this by helping members discover jobs, people, and knowledge that move their careers forward. As the professional landscape evolves, we strive to deliver search experiences that feel relevant, intuitive, personalized, and predictive of what truly matters, from applying to the right job to forming the right connection. That’s why we’ve recently introduced AI Job Search and AI-powered People Search , which go beyond keyword matching and better understand member intent. These products reimagine LinkedIn search, using large language models (LLMs) to create a semantic search experience. Instead of relying on exact word overlap between queries and postings, it interprets natural language to infer user goals and preferences. This semantic representation allows for more flexible and accurate retrieval, overcoming vocabulary gaps and aligning search results with how members naturally express their career ambitions. Deploying LLMs at LinkedIn’s scale—serving millions of real-time queries per second—requires innovation that balances quality and efficiency. In this blog, we’ll share how we transformed our overarching search experience at LinkedIn, including the challenges and decisions that went into creating a scalable LLM-based stack and how the technology is powering a smarter, faster, and more personalized experience that helps every member find the most relevant opportunities and connections. Semantic search’s high level infrastructure When a member submits a query in the search bar, a query understanding module processes the input text, creates a query embedding, and performs embedding-based retrieval (EBR) on CUDA-enabled GPUs using exhaustive vector search ( paper on GPU CUDA-based Search , paper on GPU PyTorch-based Search ) to assemble a broad set of candidate documents. The ranking stage then refines these candidates through a Cross-Encoder Small Language Model (SLM) deployed on SGLang, which combines the query, job, and member features to generate relevance and engagement scores for final ranking. To maintain scalability and efficiency, the ranking pipeline integrates several optimization techniques ( paper on efficient LLM inference infrastructure , context compression paper ): score caching, a ranking-depth controller to manage how many candidates progress to deeper ranking, and traffic shaping to balance load during peak times—all designed to enhance latency and result quality. The features and concise job representations consumed by the SLM are produced through a hybrid inference pipeline: a large-scale offline workflow using Spark and Flyte, and a low-latency nearline system using Flink. These embeddings and summaries are stored in distributed storage and retrieved on demand with minimal latency. In the final stage, the auction layer applies budget and pacing strategies to balance user relevance, engagement, and business metrics, ensuring a healthy equilibrium between recall and precision while maximizing member satisfaction. Figure 1 below provides an overview of the system architecture. Figure 1. Overall pipeline of LinkedIn’s semantic search Product policy relevance measurement Measuring relevance quality is essential to delivering a great search experience on LinkedIn. We define product policies that specify how to rate each query–document pair on a five-point scale and use LLM judges to apply these ratings at a massive scale, far beyond what manual evaluation can achieve. These judges are tightly aligned with product managers and engineers through iterative feedback to ensure high agreement. They not only grade tens of millions of query–document pairs daily for relevance measurement but also generate labeled data for training our retrieval and ranking systems, ensuring we optimize search quality according to product policy. Defining product policy and golden product manager grades A strong LLM judge begins with a clear product policy and high-quality product manager “golden” grades that demonstrate how that policy should be applied. Product managers act as a “Supreme Court,” regularly calibrating to resolve judgment differences and maintain a shared definition of what constitutes a good query–document match. These discussions refine the policy, making it clearer and less subjective. Once product managers reach high agreement (weighted Cohen’s Kappa ≥ 0.8), their labels are considered reliable ground truth. To build a comprehensive golden dataset across diverse user queries, we first categorize queries by attributes (e.g., title–company, name–company, title–skill). Each category is then split into existing user queries and aspirational queries that represent strategic areas we want to excel in. We stratify-sample query–document pairs from each bucket to ensure broad coverage before sending them to product managers for grading. Training the LLM judge Our LLM judge must meet two requirements: high agreement with product managers and the ability to grade tens of millions of query–document pairs daily. To maximize agreement, we collaborate with product managers to prompt-engineer state-of-the-art LLMs, optimizing the weighted Cohen’s Kappa Score on golden data. The prompt encodes product-policy guidelines and few-shot examples to drive consistency. While these large models produce high-quality judgments, they cannot meet our throughput needs. To scale, we distill them into a smaller 8B-parameter evaluator LLM. Through supervised fine-tuning on a diverse dataset spanning all query categories and grades, we maintain only small drops in agreement—verified via the Kappa Score on the golden set—while achieving massive efficiency gains. Continuously measuring quality of search system Once we have our scalable LLM judge, we can finally build continuous relevance measurement of our system. On a regular basis, we build workflows that perform the following steps: Stratify sample or synthesize a diverse set of queries based on the query categories defined earlier Retrieve the documents returned from executing those queries Decorate documents with additional information required for the correct evaluation/judgement Grade the documents returned using our LLM judge Calculate aggregate precision, recall, and NDCG metrics Figure 2. Flow of the evaluation process This workflow serves three primary functions: Continuously monitoring the relevance of the overall system Evaluating experiments involving underlying ranking and retrieval subsystems Distilling student ranking and retrieval models by leveraging evaluation results Search quality modeling Search quality is a fundamental requirement for any search product, and achieving it depends on building the core components of a modern search engine. Below, we describe how we leveraged LLMs to enable query understanding, semantic embedding–based retrieval, and cross-encoder ranking. Embedding-based retrieval Retrieval is the stage of a search system that identifies a broad set of potentially relevant results from a large corpus. Because no search engine can score every document for every query in real time, we need an efficient retrieval layer to narrow the search space before ranking. Our retrieval sits on top of our GPU-enabled embedding-based retrieval (EBR) system. We built the EBR model by fine-tuning an open-source LLM embedding model to encode queries and jobs into dense vectors. We train on millions of real query–job pairs sampled from production logs, with relevance labels provided by an LLM-based judge. Each query includes its natural language text and query-understanding tags (e.g. workplace type or company), and each job is represented by structured metadata (title, company) plus its description. Importantly, this work also demonstrates a practical path for deploying LLM-based components in real production search systems. The semantic search can directly understand human language as queries, enabling much more intuitive search experiences. This has been a particularly inspiring aspect of the project: bringing modern LLM capabilities into a high-scale, real-time application that serves millions of users. EBR relevance modeling To ensure consistency between training and serving, every query is formatted using a lightweight prompt template: Instruct: Given a job search query, retrieve relevant job postings Query: {query} {Optional Aspect eg. Company}: {company} The model uses a dual-tower (bi-encoder) architecture: one encoder maps queries to embeddings and the other maps jobs, projecting them into a shared semantic space. Training is end-to-end: we fine-tune all model parameters using Hugging Face Accelerate (with PyTorch FSDP) across multiple GPUs. We optimize a contrastive InfoNCE loss combined with a margin-based ranking loss. For example, given a query q, a positive job d+ , and negatives {d-k} , we define: where sim(·, ·) is the dot-product similarity of embeddings and τ is a temperature parameter. We also enhance training with hard positives and hard negatives mined from LLM-judged data. Hard positives are LLM-labeled relevant jobs that the current EBR model ranks low, and hard negatives are non-relevant jobs that the model ranks high. These examples reveal exactly where the model struggles. We then build targeted positive–negative pairs. A pairwise margin loss is applied to these curated cases to explicitly lift hard positives and suppress hard negatives, improving ranking where it matters most: which encourages sim(q,d+) to exceed sim(q,d-) by a margin γ. The total loss is a weighted sum, e.g.: combining the benefits of contrastive and pairwise ranking. We use multiple evaluation pipelines. First, we leverage production logs for counterfactual evaluation: re-ranking the historical candidate list for each query and computing precision, recall and NDCG against true labels. Second, we run offline KNN simulations: we embed held-out queries and job corpus, retrieve nearest neighbors, and directly measure retrieval metrics on this test set. Finally, we integrate the new model into our online serving stack on a subset of traffic to collect end-to-end metrics. These offline metrics provide quick feedback, and the counterfactual log analysis helps estimate the model’s user impact without a full live experiment. Productionization of retrieval In production, we precompute and store all job embeddings in GPU-backed indexes. At runtime, the incoming query is encoded by the LLM with the prompt aligned with the LLM pre-training to produce its embedding. We then perform an exhaustive k-nearest-neighbor search over the job embedding index using dot-product similarity, returning the top‑K jobs. This offline indexing and fast online query encoding makes retrieval extremely efficient, enabling low-latency serving of industry-scale semantic search products. Query understanding At the moment a member enters a query into the search bar—the entry point of semantic search—we apply a unified LLM-based understanding layer that interprets intent and converts free text into structured signals. For both AI Job Search and AI-powered People Search, this layer uses fine-tuned 1.5–4B parameter models that meet LinkedIn’s latency requirements while delivering high-precision structured outputs ( paper ). A single model handles intent classification, facet extraction, and profile-aware rewriting, replacing multiple brittle NER and heuristic components. The resulting attributes (e.g., title, company, school, location) feed directly into retrieval and ranking. An intelligent routing layer works alongside this. A lightweight encoder classifies query types at high QPS and performs policy-based safety checks before sending the query down the appropriate path—LLM-powered semantic interpretation for ambiguous inputs or efficient keyword retrieval for precise name and entity lookups. Together, these components provide a consistent, centrally governed semantic interface for People and Job Search, boosting relevance, simplifying the system, and enabling Semantic Search to scale across LinkedIn’s global traffic. Small language model ranking The ranking module of semantic search utilizes a Small Language Model (SLM) to estimate how relevant a user’s search query q is to each retrieved job_i. The SLM follows a decoder-only architecture. For example, for job search we represent the structured attributes of a job — including its title, company, location, employment type, and remote-work status. Meanwhile people search uses information from the member’s profile including their name, company information, position information, educational information and location. For each query–job pair (q,i), we build a structured prompt defined as Here, the system prefix and suffix contain chat-template tags and explicit instructions guiding the model to determine whether the given job matches the query. When this prompt is passed through the decoder, it produces logits corresponding to the next token. Let logit yes and logit no represent the logits for the tokens “yes” and “no,” respectively. Following prior studies, we compute: which yields probabilities used to rank job items by their relevance to the user’s query. SLM training pipeline for relevance quality Training of the SLM follows a multi-stage process. First, we distill the 7B-parameter teacher model into a compact 0.6B model that can generate graded relevance labels along with rationales. Next, the teacher’s ordinal grades are converted into “soft labels” ( p yes ,p no ), representing probabilistic supervision. We then perform supervised fine-tuning (SFT) to minimize the Kullback–Leibler (KL) divergence between the teacher’s soft targets and the SLM’s predicted probabilities—effectively converting the reasoning-oriented model into a binary relevance classifier: We construct training labels by sampling real query–item pairs from user interaction logs and annotating them using a full-scale Large Language Model (LLM). Each pair is evaluated through a structured prompt of the following format: [CRITERIA]: <matching guidelines> [EXAMPLES]: <reasoning and output format> [QUERY]: <query text> [CANDIDATE]: <item text> Analyze the query–candidate pair and assess how well they align.Provide a single matching score (0, 1, 2, 3, or 4) along with a brief explanation of your reasoning. The LLM’s response includes both a graded relevance score and an accompanying rationale, ensuring that the generated labels are interpretable and consistent with the defined matching criteria. The model is trained on logged pairs query–job pairs for up to five epochs using the prompt structure. Since job descriptions dominate the input and vary substantially in length (median ≈ 900 tokens; maximum > 2300), we truncate them to ensure the total prompt length does not exceed 2048 tokens during both training and inference. For evaluation, we use a holdout dataset labeled by the teacher model. The SLM ranks job candidates based on p yes ,p no , and system performance is measured using Normalized Discounted Cumulative Gain at rank 10 (NDCG@10). Training for multiple objectives We extend the training paradigm to predict both relevance and engagement within the model, we train a smaller cross-encoder language model (the SLM) using multi-teacher, multi-task distillation. The teachers include: The product policy LLM for relevance scoring. Other large models that predict member actions—such as job views, applies, recruiter accepts, or (in people search) view profile, connecting, messaging, or following. For training at scale, we use multiple 1.7B teacher models. To make this feasible, we first distilled our 7B product policy model into a smaller 1.7B version, which serves as a strong but efficient teacher alongside others. During the training process, these teachers run in real time on sampled production query–document pairs, producing soft probability scores that act as supervision targets. The student SLM is trained with KL divergence loss to align its output distribution with the ensemble of teachers. This setup lets us train on real-world data at scale: teacher models provide rich, nuanced probability signals, and the distilled student captures much of their reasoning capacity while remaining lightweight enough to serve millions of queries per second in production. We have multiple steps of distillation to SLM described in Figure 3, and we show the metrics after distillation in Table 1. Figure 3. Multi-teacher distillation of SLM NDCG@10 Apply AUC Click AUC Relevance Teacher 1.7B 0.9484 - - Engagement Teacher 1.7B - 0.8049 0.6772 SLM 0.6B (distilled) 0.9239 0.8007 0.6704 Explainability in search To make LinkedIn’s AI-powered People Search more transparent, we introduced semantic, context-aware snippets that show why a result matches a member’s query. Snippets highlight the most relevant terms and maintain low latency through lazy loading, caching. The approach uses semantic similarity between the query embedding and precomputed phrase embeddings (unigrams/bigrams) from profile text, surfacing the highest-scoring phrases as natural, human-readable snippets. In the offline pipeline, we extract phrases from each profile section (e.g., summary, experience, education), encode them into embeddings in a Venice key-value store . This index is refreshed periodically to capture profile updates, with evaluation workflows ensuring quality and readability. At search time, the snippetting midtier receives the query embedding and candidate profiles, fetches stored phrase embeddings, computes cosine similarity, selects top phrases, and expands them into readable snippets using simple heuristics. The final output is a ranked list of profiles paired with snippets and highlighting metadata. Reasoning To improve transparency in search results, we introduced a lightweight reasoning module that explains how LinkedIn interprets a member’s query. When a query is submitted, the LLM-based understanding model extracts facets, classifies intent, and—using predefined guidelines—produces a concise “thinking state” describing how the query is parsed, along with a brief summary of the types of profiles retrieved. For unsupported or negatively intended queries, the module instead provides a clear explanation of why results may be limited. For example, “berkeley community development specialist msa professional services” becomes “Searching for community development specialist at MSA Professional Services affiliated with Berkeley.” To keep latency low, reasoning outputs are cached in Couchbase and reused for repeated or semantically similar queries. SLM ranking model inference efficiency We employed multiple techniques to improve efficiency of the inference system at LinkedIn including: Model pruning, where we remove Fully Connected Layers and remove whole transformer layers. Context pruning, by summarization or embedding compression ( paper on AI modeling techniques for efficiency of SLM inference ). Model pruning To boost inference throughput, we apply model compression via structured pruning—a technique that removes redundant components to reduce model size and computation with minimal quality loss. Because our models run on GPU infrastructure, we focus on structured pruning, which removes entire neurons, attention heads, or transformer layers so the resulting model can run efficiently on standard GPU kernels. This yields real throughput and latency gains, unlike unstructured pruning, which drops individual weights but often provides no meaningful speedup without specialized hardware. We prune hidden neurons in Multi-layer Perceptron (MLP) blocks and attention heads in self-attention modules, and we remove full transformer layers to study trade-offs between size, efficiency, and performance ( paper ). Pruning MLP neurons shrinks intermediate activations, while pruning layers reduces network depth—both producing lighter, faster models. After pruning, we fine-tune the model to recover any accuracy loss, ensuring efficiency improvements do not compromise quality. Context pruning Item descriptions are long (median ~900 tokens and up to 2,300) making them over 94% of the SLM prompt and causing ~10% of inputs to be truncated at the 2,048-token limit. Removing descriptions severely degrades relevance quality, confirming they carry essential semantic information. To handle this, we use a slightly larger 1.7B LLM to summarize descriptions offline, where item-specific inference can be precomputed and refreshed via streaming updates. Because job descriptions include verbose, often irrelevant details, we train the summarizer with a semantics-preserving loss and a length-aware reward ( paper ). We fine-tune the model using RL to produce concise summaries, balancing (1) reduced input length and (2) preserved model quality. The reward combines: a semantic consistency term, measured via KL divergence between the SLM’s output distributions on summarized vs. raw text, and a length penalty that discourages overly long summaries. The weighting factor w controls the trade-off between brevity and fidelity, enabling summaries that retain meaning while reducing inference cost. Embedding compression Since the computational cost of LLM inference increases quadratically with input length, reducing the number of tokens can greatly decrease overall inference expense. On top of model pruning and summarization, we invented a text–embedding hybrid interaction architecture that condenses each item’s text into a single-token embedding generated by an encoder LLM ( paper ). These embeddings are then merged with other textual signals and passed to a ranker LLM for relevance estimation. Because the item embeddings are precomputed and stored in a nearline cache, the volume of text processed during online inference is significantly reduced, resulting in notable improvements in efficiency. We jointly train the hierarchy of two language models, where one model is producing embedding of the item description and the other model does the ranking of the candidates. On the figure below we show we use two 0.6B models trained jointly. As a result we could replace most of the job description with just a single embedding. We may keep important raw fields with a limited number of text tokens such as title of the job, company name, location or member name in the input. Figure 4. Hierarchy of SLMs trained and served in production Overall modeling quality and throughput In the table below we show how quality and inference throughput changed as we improved the modeling technology. As part of the modeling improvement we introduced multitask learning with over 6 tasks of member actions to the model output predictions including relevance, and, for example, were able to improve Click AUC of the model from 0.61 ( baseline ) to 0.67 for Job Ranking. Setup NDCG@10 Throughput (ITEMS/SEC/GPU) SLM with raw-text 0.9432 290 Pruned SLM and SUMMARIZED TEXT 0.9218 2200 SLM with EMBEDDING COMPRESSION 0.9239 22000 Embedding based retrieval (EBR) baseline 0.838 >1.6B, exhaustive search on GPU Looking ahead We built a modern semantic search system by first establishing an LLM-based quality evaluation framework grounded in product policy. On top of this foundation, we introduced LLM-powered query understanding, semantic retrieval, and ranking models—driving double-digit improvements in search quality and member engagement. Just as importantly, we achieved this while keeping inference costs comparable to traditional RecSys models previously running in production. As we continue refining Semantic Search, our focus remains on empowering every member to discover the right opportunity, connection, or insight—at the right time. Acknowledgements To the more than 100 team members who’ve contributed to AI-powered job search and people search across infrastructure, AI modeling, user experience, and data science: thank you for your creativity, grit, and teamwork. This milestone belongs to all of us.",
+    "quality_score": 8,
+    "modules": [
+      "architecture_patterns",
+      "performance",
+      "ai_assisted"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/introducing-northguard-and-xinfra",
+    "title": "Introducing Northguard and Xinfra: scalable log storage at LinkedIn",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Data is at the heart of our thousands of services at LinkedIn. Services want to subscribe to data published by other services. These subscribers need to process all the data from the originating services, or publishers, not just the latest updates. But these subscribers can have bugs, so it's desirable for these services to be able to reprocess the data as well. This allows for them to fix their bugs, reprocess the data, and verify their service is working correctly. To make this possible, 15 years ago we developed Kafka, a centralized pipeline for these publishers and subscribers. Kafka solved common problems in distributed systems such as storing large amounts of data in a consistent, replayable, and fault-tolerant way. It became the backbone of our infrastructure, supporting not just user activity events but also logging, metrics, tracing, application-to-application messaging, near real-time applications, stream processing, data lake import/export, AI features, and even database replication. This ordered data pipeline is known as a log, and the pattern of separating data producers from data consumers is called the Pub/Sub pattern. However, as LinkedIn grew and our use cases became more demanding, it became increasingly difficult to scale and operate Kafka. That’s why we’re moving to the next step on our journey with Northguard, a log storage system with improved scalability and operability. In this blog, we’ll discuss how we built Northguard and its benefits. We'll also introduce Xinfra, a virtualized Pub/Sub layer over Northguard, and explain how we transitioned from Kafka to Northguard. Why we needed a new solution In 2010, LinkedIn had 90 million members. Today, we serve over 1.2 billion members on LinkedIn. Unsurprisingly, this increase has created some challenges over the years, making it difficult to keep up with the rapid growth in the number, volume, and complexity of Kafka use cases. Supporting these use-cases meant running Kafka at a scale of over 32T records/day at 17 PB/day on 400K topics distributed across 10K+ machines within 150 clusters. Some of the main challenges: Scalability – Onboarding more use cases not only resulted in more traffic, but also more metadata, and more machines to support the added traffic. Metadata and cluster size bottlenecks were getting harder to tackle and meant setting up more clusters. Operability – Added traffic led to load balancing challenges, and with the over 100 clusters we were now running, we now needed an ecosystem of services just to manage all the clusters. Availability – limited by partitions being a heavyweight unit for replication. Consistency – was often traded off in favor of availability due to the availability impact of partitions being the unit of replication. Durability – Relatively weak guarantees were insufficient for our more critical applications. We needed a system that scales well not just in terms of data, but also in terms of its metadata and cluster size, all while supporting lights-out operations with even load distribution by design and fast cluster deployments, regardless of scale. Additionally, we required strong consistency in both our data and metadata, along with high throughput, low latency, highly available, high durability, low cost, compatibility with various types of hardware, pluggability, and testability. Introducing Northguard Northguard is a log storage system with a focus on scalability and operability. To achieve high scalability, Northguard shards its data and metadata, maintains minimal global state, and uses a decentralized group membership protocol. Its operability leans on log striping to distribute load across the cluster evenly by design. Northguard is run as a cluster of brokers which only interact with clients that connect to them and other brokers within the cluster. Let's delve into the foundational elements that power Northguard: its data model, metadata model, and protocols that underpin it. Data model Clients produce and consume records, the most granular unit of data to be read or written. Records (figure 1) are composed of a key, a value, as well as user-defined headers, all of which are just a sequence of bytes. Figure 1. a lone record A segment (figure 2) is a sequence of records. Segments are the unit of replication. They can either be active or sealed, where an active one can have records appended to it and a sealed one is immutable. Records in a segment are stamped with a logical offset relative to the start of the segment. A segment can be sealed either due to replica failure, the segment reaching a size limit of 1GB, or from the segment being active for over an hour. Figure 2. A segment with multiple records A range (figure 3) acts as Northguard's log abstraction. It's a sequence of segments associated with a contiguous range of a keyspace. Ranges can either be active or sealed. An active range could potentially have no segments at all, could have only sealed segments, or could potentially have its most recent segment be active. A sealed range could potentially have no segments at all, or could have only sealed segments, but cannot have an active segment. Figure 3. A range containing three segments A topic (figure 4) is a named collection of ranges that covers the full keyspace when combined. A topic's ranges can be split or merged. Splitting a range seals that range and creates two new ranges. Merging two ranges seals those two ranges and creates a new child range. A range can only be merged with its unique buddy range, exactly the same way that the buddy memory allocator algorithm works. A topic can be sealed or deleted. Sealing a topic seals all of its ranges. Deleting a topic deletes all of its ranges. Figure 4. A topic with a few ranges that have been split and merged A topic is configured with a storage policy. Storage policies are provided by administrators of the cluster. A storage policy has a name, a retention period that defines when segments should be deleted, as well as a set of constraints. A constraint has an expression that defines which brokers are allowed to be chosen as a replica of a segment, and how many. These expressions are based on keys and values bound to brokers called attributes. These attributes are bound to a broker process by administrators. Policies and attributes are a powerful abstraction. For example, Northguard itself has no native understanding of racks, datacenters, etc. Administrators at LinkedIn just encode this state in the policies and attributes on the brokers we deploy, making policies and attributes a generalized solution to rack-aware replica assignment. We even use policies and attributes to distribute replicas in a way that allows us to safely deploy builds and configs to clusters in constant time regardless of cluster size. Log striping The more coarse-grained your unit of replication, the more you need to worry about resource skew in your cluster. Balancing out the resource skew is difficult, and you might even rely on an entire system, like LinkedIn’s Cruise Control , just to balance resource distribution across the cluster. When your unit of replication is as coarse-grained as the log, each replica is responsible for storing a copy of the entire log. This causes a number of resource skew problems: Resource skew if brokers have more logs than other brokers. New brokers added to the cluster will remain unused until new logs are assigned onto it or move existing logs onto it. Logs are created infrequently, and moving existing logs causes operability pain. Resource skew if an unlucky broker has more resource intensive logs than other brokers. Northguard ranges avoid these issues by implementing log striping, meaning that it breaks a log into smaller chunks for balancing IO load. These chunks have their own replica sets as opposed to the log. Ranges and segments are the Northguard analog of logs and chunks. Since segments are created relatively often, we don’t need to move existing segments onto new brokers. New brokers just organically start becoming segment replicas of new segments. This also means that unlucky combinations of segments landing on a broker aren’t an issue, as it will sort itself out when new segments are created and assigned to other brokers. The cluster balances on its own. Figure 5. A cluster with a newly added Broker 5 Figure 6. A new segment gets added to the range and gets assigned to Broker 5 Ranges vs. indexed partitions When deciding how to scale throughput to topics with these striped logs, we wanted to: have correct record-to-log placement by clients minimize interruption to unrelated logs maintain some level of ordering guarantees facilitate stream processing frameworks in avoiding shuffles Ranges checked all the boxes for us. Whereas indexed partitions would’ve required a “stop-the-world” synchronization barrier for producing clients to continue to send records to the right log, ranges only interrupt clients producing to the range being split. This range split acts as the synchronization barrier, and forces clients to react to the changes made to the topic before continuing to produce. On top of that, you get some nice ordering guarantees, with range splits and merges still offering a total ordering: if a range R1 is split into R2 and R3: all records in R1 happens-before records in R2 all records in R1 happens-before records in R3 if ranges R2 and R3 are merged into R4: all records in R2 happens-before records in R4 all records in R3 happens-before records in R4 Stream processing jobs often involve joining multiple streams. To perform the join, records with the same join key across these streams need to be processed together. We can do this effortlessly by leveraging the key partitioning provided by the log storage system, as long as the partitioning of the join keys across these streams is aligned. However, if the streams being joined have unaligned partitioning of the join keys (e.g., one stream with 10 partitions and another with 16 partitions), the stream processing jobs may need to introduce a shuffle stage to repartition the records, which can be costly. Ranges offer a better solution for stream processing, as Northguard’s buddy-style ranges of different topics inherently align. We can avoid the shuffle step entirely. Metadata model Northguard has metadata for managing topics, ranges, and segments. A cluster has one or more vnodes, each storing a shard of the cluster's metadata. A vnode is a fault-tolerant replicated state machine backed by Raft and acts as the core building block behind Northguard's distributed metadata storage and metadata management. Figure 7. A vnode’s Raft group A coordinator is the leader of a given vnode. It manages all the metadata owned by a vnode. This is where the “business logic” of the metadata lives. When the vnode's state machine elects a new leader, the coordinator of the vnode moves to the new leader as well. The coordinator persists state in the vnode state machine so that a newly elected coordinator can pick up from where the previous one left off. For topics owned by a vnode, the coordinator tracks changes such as sealing or deleting the topic and splitting or merging ranges from that topic. For ranges owned by a vnode, the coordinator tracks metadata like the range's active/sealed/deleting state, the creation time, the retention, and the topic name. It also stores metadata on the segments like the segment's replica set, the active/sealed/reassigning state of the segment, the start offset and length of the segment, the create time, and seal time of the segment. The coordinator uses this segment state to initiate sealed segment replication for under-replicated segments, making Northguard self-healing. The Dynamically-Sharded Replicated State Machine (DS-RSM) is a collection of vnodes covering a hash ring. Metadata is sharded across vnodes using consistent hashing. Topic metadata is hashed by topic name, while range and segment metadata is hashed by range ID. This minimizes metadata hotspots. Figure 8. A DS-RSM with 3 vnodes A cluster can be configured with a metadata policy provided by administrators of the cluster. A metadata policy has a name and one or more constraints. These constraints behave exactly the same as the ones in storage policies, where its expressions are once again based on the attribute keys and values bound to brokers by administrators. The metadata policy defines how replicas of the vnodes are chosen. Cluster state and membership Northguard uses SWIM as its scalable group membership protocol. SWIM employs random probing for failure detection but infection-style dissemination for membership changes and broadcasts. We use this broadcast mechanism to distribute minimal global cluster state such as basic host, port, and attributes of the brokers in the cluster as well as minimal information about this DS-RSM hash ring such as each vnode's hash ring start and end boundaries, the vnode leader, vnode current term, and vnode replicas. This facilitates routing of certain requests to the appropriate vnode leader. Figure 9. The SWIM protocol in action Protocols Northguard’s metadata protocols are unary: one request results in one response. Examples include CreateTopicRequest, DeleteTopicRequest, TopicMetadataRequest, and SegmentMetadataRequest. Clients send these requests to any broker in the cluster, which acts as a proxy. The broker uses its local copy of gossipped global state to determine which vnode can serve the request and relays it to the leader of that vnode. The response follows the same path back to the client. While metadata protocols are unary, Northguard’s produce, consume, and replication protocols are all sessionized streaming protocols. We sessionize state to the stream to avoid protocol overhead. These protocols use pipelining to keep data moving and windowing to control how much can be pipelined at any time. Let’s take produce streams as an example. The producing client generates a stream ID and initiates a handshake with the active segment leader, learning the initial window size accepted by the broker. The producer sends multiple Appends to the broker as long as the records haven’t exceeded the window. Each append contains the stream ID, sequence number, and one or more records. The broker can send M Acks for N Appends and is only allowed to send the producer an Ack for records that have been committed. These Acks include an acknowledgement number correlating with the sequence number from Append and an updated window for more Appends. Figure 10. A producer sending records and getting acknowledgements over a produce stream Consume streams are very similar to produce streams but with records flowing in the reverse direction and the client determining the window size. After the handshake, the consumer sends Reads telling the broker their progression of the stream and potentially updated window size. Brokers send Pushes as long as the records being pushed haven’t exceeded the window. Figure 11. A consumer receiving records and asking for more over a consume stream Active segment replication works similarly to produce streams, using record offsets instead of sequence numbers. ReplicaAppends also include a committed state for followers to track progress of what’s been committed. Figure 12. An active segment follower receiving records and asking for more over a replica stream Sealed segment replication replenishes under-replicated segments, and is literally the consume protocol, but between two brokers. Segment storage Segment storage in Northguard is pluggable, but the primary implementation, called the “fps store,” has a write-ahead-log (WAL), creates a file-per-segment, uses Direct I/O, and maintains a sparse index in RocksDB. Appends are accumulated in a batch until sufficient time has passed (ex: 10 ms), the batch exceeds a configurable size, or the batch exceeds a configurable number of appends. Once ready to flush the batch, the store synchronously writes to the WAL, appends records to one or more segment files, fsyncs these files, and updates the index. With Direct I/O, Northguard avoids double buffering, and instead uses application-level caching that leverages its knowledge of established consume streams to populate the cache. Direct I/O also enhances Northguard's durability by maintaining consistent state across fsync failures. It helps us avoid cache degradation issues we might’ve otherwise seen in the page cache on replicas that clients aren’t consuming from, or when, for example, consumers or sealed segment replication wants to consume old segments. Testing On top of having thousands of tests, microbenchmarks, and a rigorous certification pipeline, we also run Northguard under deterministic simulation. This means we run a cluster as well as clients under a single thread and swap out nondeterministic components with deterministic versions of them. We simulate years of activity under various scenarios every day, where the scenarios are injecting many kinds of faults into the simulation: broker shutdown rolling restarts network partition packet loss packet corruption disk corruption disk io errors config deployments We can easily share, replay, and step through failed runs, and this helps us catch bugs before they happen in production. Evaluation Let’s recap some of the key points: Kafka Northguard Scalability: Data logs bounded by machine disk capacity logs bounded by cluster disk capacity Scalability: Metadata Control Plane Bottlenecked by: 1 controller 1 replicated state machine Stressed at millions of partition replicas. N (128+) coordinators N (128+) sharded replicated state machines Does fine with millions of segment replicas. Scalability: Metadata Distribution Global topic metadata state Minimal global state Scalability: Cluster Size Centralized group membership heartbeating to controller Scalable gossip group membership Operability: Cluster Count 80%+ fewer Operability: Balanced Data Distribution External service to keep the cluster balanced. Balanced by design Operability: Metadata Distribution N/A (metadata isn’t sharded) Balanced by design Operability: Adding Brokers External service to move existing data onto the new broker to keep the cluster balanced. No need to move existing data onto new brokers. Operability: Replenish Replication Factor External service to restore replication factor while keeping the cluster balanced. Self-healing Availability Produce availability degrades as replicas fail Striping gives us higher availability. Producers move onto new segments when a segment replica fails. Consistency Partitions as the unit of replication means long periods to replenish. We configured topics to sacrifice consistency for produce availability. Segments as the unit of replication and log striping means that we don't need to sacrifice consistency in order to preserve produce availability when brokers start to fail. Durability Lazy syncs: 10 seconds 20k records Fsync on all replicas before produce ack: 10 milliseconds 20k records 10 MB Performance Meets LinkedIn’s SLOs for Kafka with better durability. Migrating from Kafka to Northguard Migrating user topics from one Kafka cluster to another is difficult, and migrating users from one Pub/Sub system (Kafka) to another (Northguard) is even harder. Thousands of applications, including mission-critical ones, need to be migrated. We’re talking about migrating several hundreds of thousands of topics and hundreds of clusters. Application downtime is unacceptable during migration, and handling individual applications separately is not scalable. Part of the migration challenge comes from users relying on the Kafka client, which talks to a single Kafka cluster at a time. The lack of virtualization complicates the transition to a new system with a different data model and protocols. Another challenge in LinkedIn’s infrastructure is that adding a new cluster to handle traffic growth is often not transparent to the users. Pub/Sub Virtualization can help by hiding physical aspects of a Pub/Sub cluster, making it possible to virtually grow a cluster without requiring changes from applications. Introducing Xinfra Xinfra (pronounced as ZIN-frah) is a virtualized Pub/Sub layer supporting both Northguard and Kafka. It offers a unified Pub/Sub experience for customers. With virtualization, a Xinfra topic is no longer tied to a single Kafka cluster. A Xinfra topic has epochs (which captures the topic change history), allowing it to have an epoch in a Kafka cluster and another in a Northguard cluster, as seen below in figure 13. Figure 13. An example Xinfra topic with multiple epochs This means users don't need to change the topic when it is migrated between clusters at runtime. Topic virtualization also allows grouping topics located in different physical clusters under the same virtualized cluster. This enables Xinfra to federate multiple physical clusters to support large use cases that would otherwise be infeasible with a single physical cluster. Figure 14. An example use case where a consumer subscribes to three topics under the same virtual cluster, with each topic located in different clusters Users interact with Northguard and Kafka via Xinfra clients, which provide a unified API for accessing pub/sub infrastructure at LinkedIn. Each epoch in a Xinfra topic contains a list of shards (similar to topic partition in Kafka). Xinfra producers offer \"produce to a topic\" and \"produce to a shard\" APIs. Xinfra consumers provide both manual shard assignment-based consumption and consumer group management-based consumption. The Xinfra-metadata-service is a robust Pub/Sub ecosystem management system for Xinfra clients. It provides a virtualized and unified view across multiple Pub/Sub systems, streamlining operations and abstracting away the complexities of underlying infrastructure. Additionally, it offers essential Pub/Sub capabilities, such as consumer group management and checkpoint storage, at the virtual layer—ensuring a seamless and consistent experience for the users. Xinfra-metadata-service handles virtual topics and clusters, including mapping between virtual and physical topics/shards. It also enables essential operations such as creating, updating, deleting, and migrating topics at the virtual layer. To ensure persistence, all metadata for both virtual and physical topics/clusters is stored in MySQL. Xinfra-metadata-service also keeps track of all connected Xinfra producers and consumers, providing consumer group management and checkpoint storage over the virtual layer, ensuring a seamless experience for users. Xinfra-metadata-service leverages Zookeeper to maintain cluster consistency, handling membership, leadership, and group allocation during consumer group management. It ensures incremental group rebalancing, fair shard allocation within consumer groups, and resilience against network partitions or crashes. For checkpoint storage, Xinfra-metadata-service utilizes Vitess, a sharded MySQL solution, along with a coalescing buffer for efficiency. Additionally, it integrates Couchbase as a caching layer to achieve low-latency checkpoint reads and writes. The Xinfra-metadata-service Xinfra-based pub/sub migration Xinfra natively supports topic migration from one cluster to another and from one Pub/Sub system to another. It leverages dual-write approaches and staged migration steps to migrate user topics. At a high level, the migration process begins by creating a new topic epoch in the target cluster. Producers are migrated first, followed by consumers. Producers perform dual writes during the migration period to allow a safe rollback in case of migration failure. Ordering guarantees are maintained through the migration process. The migration is transparent to users, and the migration state is delivered via Xinfra topic metadata update to the client. Producers and consumers continue to work throughout the migration process. The final stage of migration involves turning off dual writes. Post-migration, consumers can still read through epochs, including data in the previous epoch, until the data is deleted by retention policy. Current state and what’s next Xinfra has been widely adopted within LinkedIn, with over 90% applications running Xinfra clients. We have successfully migrated thousands of topics from Kafka to Northguard, accounting for trillions of records per day. Looking ahead, our focus will be on driving even greater adoption of Northguard and Xinfra, adding features such as auto-scaling topics based on traffic growth, and enhancing fault tolerance for virtualized topic operations. We are thrilled to continue this journey!",
+    "quality_score": 9,
+    "modules": [
+      "architecture_patterns",
+      "concurrency",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://github.blog/engineering/engineering-principles/how-githubs-developer-experience-team-improved-innerloop-development/",
+    "title": "How GitHub's Developer Experience team improved innerloop development",
+    "source_name": "The GitHub Blog",
+    "text": "Our latest solution to the ubiquitous engineering problem of integration testing in a distributed service ecosystem here at GitHub. January 24, 2024 | Updated January 29, 2024 | 8 minutes Share: Building confidence in new code before deploying is a crucial part of any good development loop. This is especially challenging when working in a distributed or microservice system with multiple teams operating on different services. This modular team structure gives rise to an important question: how can we provide teams with fast and reliable development cycles when testing and shipping requires them to test inside an ecosystem of other services? Optimizing the solution to this problem greatly improves engineering efficiency and can contribute to more successful outcomes for the organization as a whole. This problem is one the Developer Experience (DX) team at GitHub grappled with again and again, ultimately delivering a solution we call “Hubber Codespace” (HCS). HCS is a tool that Hubbers (people who work at GitHub) can use to locally stand up the entire distributed GitHub ecosystem in any environment by simply querying an endpoint or adding a couple lines of configuration to their development containers. In this post, we’ll tell you how we landed on the HCS solution to this common problem over some possible alternatives, and you’ll get a first-hand look at how GitHub’s developer-first mindset helped us deliver the best tool for Hubbers to ship code quickly and safely in our own distributed environment. One big (un)-happy environment To understand the problem we were trying to solve, we have to go back in time. There was a point at which GitHub was just a couple teams and a much simpler product. Back then, having a monorepo in which everyone iterated and built confidence in their changes made sense. Splitting responsibilities up across repositories would have added overhead that bogged down early Hubbers. Fast forward to today, and GitHub has grown into a big organization with hundreds of different teams. Now, the balancing act of evaluating between velocity vs. complexity can look very different. Let’s consider these complexities a bit further. Different services can have entirely different sets of dependencies and even have dependencies on different versions of the same software (for example, one service requires Ruby 2.2 while another requires Ruby 2.4). In smaller collaborative settings, the engineers can easily reconcile these needs. But this complexity grows exponentially as more teams are introduced. Trying to provide a single environment in which these kinds of disparate services can run and interact in development becomes difficult to do. It can result in ad-hoc “hacks” in development loops like deleting a .ruby-version file depending on which service’s development loop you’re working through. These are the kinds of problems that you encounter when trying to work with a monorepo that contains the codebases for a set of disparate services. So, we decided to design a new solution. Instead of bringing the developers to the ecosystem, what if we brought the ecosystem to the developers? Enter HCS This line of thinking led us to build HCS, a Docker-Compose project that does exactly that. In the post “ How we build containerized services at GitHub using GitHub ,” we detailed how we build containerized services that power microservices on the GitHub.com platform and many internal tools. Our task now was to take these containers and wire them up such that partner teams could spin up a full GitHub ecosystem on demand. This would allow them to test their changes in an integrated environment. Developers could see how their code behaves when introduced to GitHub’s distributed system, rather than only observing it in the isolated environment of the application being developed before deploying within the full system. In this way, developers could gain confidence that the services they were changing behaved correctly when interacting with their up and downstream dependencies. When considering how to orchestrate all the required containers, a few solutions came to mind: Docker-Compose, an internal tool called Codespace-Compose that allows us to SSH tunnel between multiple codespaces, and Minikube. Any of these three solutions could solve the ecosystem problem and would have unique tradeoffs. Let’s look at some of those tradeoffs now. Minikube offers a robust Kubernetes architecture, but we had concerns about the overall user experience. We ultimately decided against it as the issues we identified, such as networking complexity and long cycle times, could bog down development speed. Codespace-Compose allows us to easily connect teams’ everyday development environments, but we reasoned that, since Codespace-Compose is an internal experiment without any SLA, we’d incur a maintenance cost on our own team by adopting this. Docker-Compose seemed to fit our needs the best. It didn’t incur any additional maintenance burden since it’s publicly available and actively managed. It offers all the same benefits of Minikube without the long cycle time. Most importantly, using Docker in Docker in a codespace, which allows us to create docker containers on a host which is a docker container itself, is a well-paved path that has lots of prior art. Given all these considerations, we decided on orchestrating our containers using Docker-Compose. After deciding on Docker-Compose as our orchestrator, the next steps were to figure out the interface. Docker-Compose already supplies end users with commands, but we wanted to optimize the UX around HCS. To do this, we built a user-friendly CLI in Golang with parallel versioning to HCS. This abstracted away all the complexity of using the two together. Simply download a specific release version for HCS, get the same version of the CLI binary, and you’re good to go! CLI and release automation Ensuring HCS is useful means ensuring a couple of things. One important goal is ease of use. Docker-Compose already offers an interface for end users, but considering some of the built in commands are long and use predictable options, we decided to wrap it in a custom Golang CLI. This abstracted many of the underlying details away, such as static file locations, formatting options, entrypoint commands, etc. to improve end-user experience. The code below shows this by juxtaposing the Docker-Compose commands with their equivalent HCS CLI command. The following example compares the commands to start up the integrated environment provided by HCS. # Start using Docker-Compose docker compose --project-name hcs \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-actions.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-base.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-bg.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-core.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-volume.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-test.yml \\ --file /workspaces/hubber-codespace-dist/docker-compose-hcs-vendor.yml \\ --profile full up -d --remove-orphans # Start using CLI hcs start This next example compares how to get a shell to run commands from inside the various containers in GitHub’s distributed ecosystem. This allows developers to modularly interact with and make ephemeral changes to the system. # Run command from inside a container in the system using Docker-Compose docker compose --project-name hcs exec bash # Run from inside a container using CLI hcs shell This example compares how to check the status of the containers in the project so end-users can easily see the health of the entire system. # Status using Docker-Compose docker compose --project-name hcs ps --format json # Status using CLI hcs status In addition to this easy-to-use and ergonomic CLI, we had to ensure that HCS runs an up-to-date version of the GitHub ecosystem. GitHub is made up of so many different moving pieces that testing new changes on code that’s even a couple days old would not be sufficient to build confidence. When iterating directly on the monorepo, this was a non-issue since folks just fetched the main branch. For HCS, this required us to build automation that cuts releases on a frequent cron schedule. A release of HCS is a software artifact containing the compiled Golang binary for HCS and its CLI that can be pulled using the gh CLI. The diagram below illustrates how this process works. End-user experience Using HCS directly in your codespace We’ve recently made efforts to push all development at GitHub onto GitHub Codespaces . A codespace is a custom development container , or devcontainer, based on a configuration file in a repository. A repository can have multiple codespaces associated with it as long as each has a unique configuration file. On top of the obvious benefits of having a reproducible environment on demand to develop and iterate in, devcontainers offer features . This abstraction allows developers to easily add software to their environments. HCS is also consumable this way. The code block below shows the couple lines needed to bring this entire ecosystem to a partner team’s preferred environment (that is, their codespace). { … \"features\": { … \"ghcr.io/devcontainers/features/github-cli:1\": { \"version\": \"latest\" }, //docker-in-docker required for hcs \"ghcr.io/devcontainers/features/docker-in-docker:2\": {}, // Include the hubber-codespace feature \"ghcr.io/github/hubber-codespace/hcs:1\": {}, \"ghcr.io/devcontainers/features/go:1\": {} … } } Now, teams can perform integration testing against the many other services in GitHub’s ecosystem from directly in the codespace where they were doing local development. Release binary Even with the push towards codespaces, not every context that requires an ecosystem will be a devcontainer. In light of this, we also gave end users the option to download the release directly from the GitHub API. The commands to do so can be seen below. With a couple simple commands, Hubbers now have everything they need to bring the entire GitHub ecosystem to whatever environment they want. gh release download --repo github/hubber-codespace -p hcs -D /tmp/ chmod +x /tmp/hcs sudo mv /tmp/hcs /usr/local/bin hcs init hcs pull hcs start Testimonials But don’t just take my word for it. Check out what our partner teams have had to say about HCS improving their development loop: “HCS has improved our dev loop for [our service] by making it simple to test [it] against [the rest of GitHub’s ecosystem]. It’s turned what used to be a number of manual steps to clone our repository into the [monorepo environment] into two simple commands in our own codespace. This has made it much easier to validate our changes without having to deploy to a staging environment.” “Given that we are a service operating outside GitHub but with a heavy reliance on the services running within GitHub, we’ve had to go through a lot of bells and whistles to ensure we can have a smooth development experience. In my four years working on [our service], HCS has been the most seamless experience in going from a blank devbox to breakpointing live running code for our service.” Conclusion Solving the ecosystem problem is always a balancing act. Luckily, thanks to GitHub’s push towards containerization, and tooling such as repository automation and publishing/consuming releases through the GitHub CLI, we were adequately equipped to develop a solution with HCS. Hubbers can now leverage a development loop that allows them to deploy with confidence, having tested their changes within GitHub’s complex multi-service system. Written by Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "testing",
+      "integration",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://github.blog/2024-06-03-how-github-reduced-testing-time-for-ios-apps-with-new-runner-features/",
+    "title": "How GitHub reduced testing time for iOS apps with new runner features",
+    "source_name": "The GitHub Blog",
+    "text": "Learn how GitHub used macOS and Apple Silicon runners for GitHub Actions to build, test, and deploy our iOS app faster. June 3, 2024 | Updated July 23, 2024 | 4 minutes Share: GitHub Actions 🤝 GitHub for iOS The GitHub iOS and GitHub Actions macOS runner teams are integral parts of each other’s development inner loop. Each team partners on testing new runner images and hardware long before the features land in the hands of developers. GitHub Actions has been working hard at bringing the latest Mac hardware to the community. Apple silicon (M1) macOS runners are available for free in public repositories, along with larger options available for those jobs that need more performance. The GitHub iOS team has been busy improving the user experience in the app, recently shipping such as GitHub Copilot Chat , code search, localization for German and Korean, and making it easier to work with issues and projects. In this blog, we will discuss how the GitHub iOS team brings the app to developers around the world, the benefits of Apple silicon, and building on GitHub Actions using macOS runners. How GitHub reduced testing time for iOS apps with new runner features The GitHub iOS team previously used a single workflow with one job to build and test the entire codebase on GitHub Actions that took 38 minutes to complete with the prior generation runners. The GitHub iOS app consists of about 60 first-party modules, consisting of various targets, such as dynamic frameworks, static libraries, app extensions, or the GitHub app itself. These modules range from networking layers to design system components to entire features or products, helping us maintain the app. Breaking down the monolith We decided to leverage the power of Apple silicon to speed up their testing process. We switched to M1 macOS runners (macos-14-xlarge YAML label) on GitHub Actions and split their test suite into separate jobs for each module. This way, they could build and test each module independently and get faster feedback. Some of the smallest modules completed their tests in as little as 2-3 minutes on M1 macOS runners, getting feedback to developers on their pull requests faster than ever before. This also made it easier to identify and fix failures on specific modules without waiting for a monolithic build to finish. By using Apple silicon, we reduced their testing time by 60%, from 38 minutes to 15 minutes, and improved our productivity and efficiency. The figure below demonstrates how we broke down the monolith into small modules in order to improve our build times. As each build is kicked off, GitHub Actions is behind the scenes preparing the required number of machines to execute the workflow. Each request is sent to the GitHub Actions service where it picks up a freshly reimaged virtual machine to execute the required number of jobs. The figure below shows how a request travels from our repository to the Actions Mac servers in Azure. With shorter build times and a scaling CI fleet, Apple silicon hosts allowed the GitHub iOS team to scale their jobs out across many shorter, faster steps, with GitHub Actions abstracting over the complexity of distributing CI jobs. Analyzing CI performance We further investigated the CI performance and divided each module’s CI into two separate steps, build and test, using xcodebuild’s build-without-testing and test-without-building. This helped us identify unit tests that ran for a long time or highlighted fast unit tests that finished in seconds. Native development and test environments With Apple silicon powering GitHub Actions runners and the developers’ laptops, our CI now had the same architecture as local development machines. Engineers could identify patterns that took a long time to compile or tests that failed due to the architecture from CI and fix them locally with confidence. Benefits of Apple silicon Apple silicon improves build performance, increases reliability, and lets iOS teams test natively for all Apple platforms throughout the software development lifecycle. They can avoid problems from cross-compilation or emulation and use the latest simulators on our GitHub Actions runner image. This ensures that their apps work well with the newest versions of iOS, iPadOS, watchOS, and tvOS. Our GitHub Actions M1 macOS runners help iOS teams leverage these benefits and deliver high-quality apps to their users faster and more efficiently. Additionally, GitHub Actions offers 50 concurrent runners for enterprise accounts and five for GitHub Free and Team plans. The GitHub for iOS team takes full advantage of these concurrent runners and initiates 50 jobs for every pull request to perform modular testing on the app in parallel. Get started building on GitHub Actions using macOS runners GitHub-hosted macOS runners are YAML-driven, meaning they are accessed by updating the runs on: key in your workflow file. Standard GitHub-hosted runners for Public repositories Standard GitHub-hosted runners for Private repositories macOS larger runners Written by Senior Product Manager Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "testing",
+      "performance",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://stripe.com/blog/introducing-stripes-new-api-release-process",
+    "title": "Introducing Stripe's new API release process",

--- src/ai/post-generator.ts
diff --git a/src/ai/post-generator.ts b/src/ai/post-generator.ts
index a5f8af8..49c2127 100644
--- a/src/ai/post-generator.ts
+++ b/src/ai/post-generator.ts
@@ -3,7 +3,7 @@ import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
 import { computeEditRatio } from '../voice/similarity.js';
 import type { IAIClient } from './types.js';
 import type { Finding } from '../analysis/types.js';
-import type { IVoiceStorage, VoicePost } from '../voice/storage.js';
+import type { IVoiceStorage, SaveDraftInput, VoicePost } from '../voice/storage.js';
 import type { EnrichedCommit } from '../github/commit-enricher.js';
 import type { Config } from '../config/schema.js';
 
@@ -27,6 +27,7 @@ export async function generatePosts(
   config: Config,
   recentModuleIds: string[] = [],
   industryContext?: string,
+  draftMetadata: Partial<SaveDraftInput> = {},
 ): Promise<GeneratedPosts> {
   if (findings.length === 0) {
     throw new Error('generatePosts called with 0 findings — caller should skip this call');
@@ -64,6 +65,7 @@ export async function generatePosts(
     top_finding: topFinding,
     top_module_id: topModuleId,
     findings_count: findingsCount,
+    ...draftMetadata,
   });
 
   // Buffer Idea text includes both variants so Liliana can copy per platform in the UI


--- src/buffer/sent-scanner.ts
diff --git a/src/buffer/sent-scanner.ts b/src/buffer/sent-scanner.ts
index f28dab6..c8ad9a5 100644
--- a/src/buffer/sent-scanner.ts
+++ b/src/buffer/sent-scanner.ts
@@ -87,6 +87,7 @@ async function scanPlatform(
         edit_ratio: bestScore,
         published_at: publishedAt,
         linkedin_urn: linkedinUrn,
+        publish_source: 'buffer',
       });
       logger.info('sent_scanner.matched', {
         draftId: bestDraft.id,


--- src/content/article-extractor.ts
diff --git a/src/content/article-extractor.ts b/src/content/article-extractor.ts
index c76c246..beb790a 100644
--- a/src/content/article-extractor.ts
+++ b/src/content/article-extractor.ts
@@ -1,11 +1,26 @@
+import { existsSync, readFileSync } from 'fs';
 import { extract } from '@extractus/article-extractor';
+import { parse } from 'yaml';
 import { logger } from '../utils/logger.js';
 import type { ArticleText } from './types.js';
 
 const EXTRACT_TIMEOUT_MS = 30_000;
+const PUPPETEER_LAUNCH_TIMEOUT_MS = 20_000;
+const PUPPETEER_TOTAL_TIMEOUT_MS = 45_000;
 const MIN_WORD_COUNT_RESULT = 100;   // below this = extraction failed
 const MIN_WORD_COUNT_ACCEPT = 300;   // below this = use Puppeteer fallback for curated
 const USER_AGENT = 'devcast/1.0 (+https://devcast.lilicurl.com)';
+const DEFAULT_PUPPETEER_FALLBACK_HOSTS = [
+  'discord.com',
+  'stripe.com',
+] as const;
+
+interface ExtractionPolicy {
+  readonly puppeteerFallbackHosts: Set<string>;
+  readonly source: 'default' | 'env' | 'config';
+}
+
+let cachedExtractionPolicy: ExtractionPolicy | null = null;
 
 /**
  * Three-layer extraction strategy:
@@ -28,10 +43,21 @@ export async function extractArticle(
   rssText: string | null,
   isCurated: boolean,
 ): Promise<ArticleText | null> {
+  const host = getHostname(url);
+  const extractionPolicy = getExtractionPolicy();
+  const allowPuppeteerFallback = isCurated && shouldUsePuppeteerFallback(url, extractionPolicy);
+
   // Layer 1: RSS content
   if (rssText) {
     const rssResult = parseRssText(rssText);
     if (rssResult && rssResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
+      logger.info('content.extract.success', {
+        url,
+        host,
+        layer: 'rss',
+        wordCount: rssResult.wordCount,
+        isCurated,
+      });
       return rssResult;
     }
   }
@@ -39,18 +65,44 @@ export async function extractArticle(
   // Layer 2: URL fetch
   const urlResult = await extractFromUrl(url);
   if (urlResult && urlResult.wordCount >= MIN_WORD_COUNT_ACCEPT) {
+    logger.info('content.extract.success', {
+      url,
+      host,
+      layer: 'url',
+      wordCount: urlResult.wordCount,
+      isCurated,
+    });
     return urlResult;
   }
 
   // Layer 3: Puppeteer — curated sources only
-  if (isCurated) {
-    logger.info('content.extract.puppeteer', { url });
+  if (allowPuppeteerFallback) {
+    logger.info('content.extract.puppeteer', {
+      url,
+      host,
+      policySource: extractionPolicy.source,
+    });
     const puppeteerResult = await extractWithPuppeteer(url);
     if (puppeteerResult && puppeteerResult.wordCount >= MIN_WORD_COUNT_RESULT) {
+      logger.info('content.extract.success', {
+        url,
+        host,
+        layer: 'puppeteer',
+        wordCount: puppeteerResult.wordCount,
+        isCurated,
+      });
       return puppeteerResult;
     }
   }
 
+  logger.warn('content.extract.fail', {
+    url,
+    host,
+    isCurated,
+    attemptedPuppeteer: allowPuppeteerFallback,
+    policySource: extractionPolicy.source,
+  });
+
   return null;
 }
 
@@ -77,51 +129,110 @@ async function extractFromUrl(url: string): Promise<ArticleText | null> {
       wordCount,
       publishedAt: article.published ? new Date(article.published) : null,
     };
-  } catch {
+  } catch (err) {
+    logger.debug('content.extract.url.fail', {
+      url,
+      host: getHostname(url),
+      error: String(err),
+    });
     return null;
   }
 }
 
 async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
   // Dynamic import to avoid loading Puppeteer when it is not needed
-  let browser;
+  let browser: {
+    close(): Promise<void>;
+    newPage(): Promise<{
+      setDefaultNavigationTimeout(timeout: number): void;
+      setDefaultTimeout(timeout: number): void;
+      setUserAgent(userAgent: string): Promise<void>;
+      goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<unknown>;
+      waitForSelector(selector: string, options: { timeout: number }): Promise<unknown>;
+      waitForNetworkIdle(options: { idleTime: number; timeout: number }): Promise<unknown>;
+      evaluate(script: string): Promise<unknown>;
+      title(): Promise<string>;
+    }>;
+    process(): { kill(signal?: NodeJS.Signals | number): boolean } | null;
+  } | undefined;
+  let skipBrowserClose = false;
   try {
-    const { launch } = await import('puppeteer-core');
-    const puppeteerFull = await import('puppeteer');
-    const executablePath = puppeteerFull.executablePath as () => string;
-
-    browser = await launch({
-      executablePath: executablePath(),
-      headless: true,
-      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
-    });
+    return await withTimeout(
+      (async () => {
+        const { launch } = await import('puppeteer-core');
+        const puppeteerFull = await import('puppeteer');
+        const executablePath = puppeteerFull.executablePath as () => string;
 
-    const page = await browser.newPage();

--- src/content/classifier.ts
diff --git a/src/content/classifier.ts b/src/content/classifier.ts
index a92cdaf..3fa2ed9 100644
--- a/src/content/classifier.ts
+++ b/src/content/classifier.ts
@@ -6,7 +6,7 @@ const QUALITY_GATE = 6;
 const BATCH_POLL_INTERVAL_MS = 30_000;   // 30s between polls
 const BATCH_TIMEOUT_MS = 2 * 60 * 60 * 1000;  // 2 hours max wait
 
-const SYSTEM_PROMPT = `You are evaluating a technical article for depth and originality.
+export const CONTENT_CLASSIFIER_SYSTEM_PROMPT = `You are evaluating a technical article for depth and originality.
 
 Rate the article on a scale of 1-10:
 - 1-3: tutorial, rehash of documentation, or surface-level overview
@@ -56,8 +56,8 @@ export async function classifyArticlesBatch(
   const requests: Anthropic.MessageCreateParamsNonStreaming[] = articles.map((article) => ({
     model,
     max_tokens: 512,
-    system: SYSTEM_PROMPT,
-    messages: [{ role: 'user', content: `Title: ${article.title}\n\n${article.text}` }],
+    system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
+    messages: [{ role: 'user', content: buildClassifierUserPrompt(article) }],
   }));
 
   const batchRequests = articles.map((article, i) => ({
@@ -120,7 +120,45 @@ export async function classifyArticlesBatch(
   return classified;
 }
 
-function parseClassifierResponse(raw: string): ClassifierResult | null {
+export async function classifyArticleRealtime(
+  article: ArticleToClassify,
+  apiKey: string,
+  model: string,
+): Promise<ClassifierResult> {
+  const client = new Anthropic({ apiKey });
+  return classifyArticleRealtimeWithClient(article, client, model);
+}
+
+export async function classifyArticleRealtimeWithClient(
+  article: ArticleToClassify,
+  client: Anthropic,
+  model: string,
+): Promise<ClassifierResult> {
+  const userPrompt = buildClassifierUserPrompt(article);
+
+  for (let attempt = 0; attempt < 2; attempt++) {
+    const response = await client.messages.create({
+      model,
+      max_tokens: 512,
+      system: CONTENT_CLASSIFIER_SYSTEM_PROMPT,
+      messages: [{ role: 'user', content: userPrompt }],
+    });
+
+    const block = response.content[0];
+    if (block?.type !== 'text') {
+      throw new Error('Classifier returned a non-text response');
+    }
+
+    const parsed = parseClassifierResponse(block.text);
+    if (parsed) {
+      return parsed;
+    }
+  }
+
+  throw new Error(`Classifier returned invalid JSON for article ${article.id}`);
+}
+
+export function parseClassifierResponse(raw: string): ClassifierResult | null {
   // Strip markdown code fences if present
   const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
   try {
@@ -145,6 +183,10 @@ function toStringArray(val: unknown): string[] {
   return val.map(String);
 }
 
+function buildClassifierUserPrompt(article: ArticleToClassify): string {
+  return `Title: ${article.title}\n\n${article.text}`;
+}
+
 function sleep(ms: number): Promise<void> {
   return new Promise((resolve) => setTimeout(resolve, ms));
 }


--- src/content/content-storage.ts
diff --git a/src/content/content-storage.ts b/src/content/content-storage.ts
index 0201d29..d0e8006 100644
--- a/src/content/content-storage.ts
+++ b/src/content/content-storage.ts
@@ -1,6 +1,6 @@
 import type { SupabaseClient } from '@supabase/supabase-js';
 import { logger } from '../utils/logger.js';
-import type { ContentItem } from './types.js';
+import type { ContentSource } from './types.js';
 
 export interface ArticleToStore {
   readonly sourceId: string;
@@ -12,6 +12,7 @@ export interface ArticleToStore {
   readonly mainThesis: string;
   readonly keyInsights: string[];
   readonly techConcepts: string[];
+  readonly seedModules?: string[] | null;
   readonly qualityScore: number;
   readonly titleHash: string;
   readonly fingerprint: string;
@@ -44,6 +45,7 @@ export async function storeArticle(
       main_thesis: article.mainThesis,
       key_insights: article.keyInsights,
       tech_concepts: article.techConcepts,
+      seed_modules: article.seedModules ?? null,
       quality_score: article.qualityScore,
       title_hash: article.titleHash,
       fingerprint: article.fingerprint,
@@ -185,17 +187,18 @@ export async function updateSourceStats(
 }
 
 /**
- * Returns all active sources (status IN active, probation).
- * Also returns unreachable sources for retry attempt.
+ * Returns fetchable sources for the weekly pipeline.
+ * Protected sources are static corpus anchors and are never re-fetched.
  */
-export async function loadActiveSources(db: SupabaseClient): Promise<ContentItem[]> {
+export async function loadActiveSources(db: SupabaseClient): Promise<ContentSource[]> {
   const { data, error } = await db
     .from('content_sources')
     .select('*')
-    .in('status', ['active', 'probation', 'unreachable']);
+    .in('status', ['active', 'probation', 'unreachable'])
+    .eq('is_protected', false);
 
   if (error) throw new Error(`Failed to load active sources: ${error.message}`);
-  return (data ?? []) as ContentItem[];
+  return (data ?? []) as ContentSource[];
 }
 
 /**


--- src/content/matcher.ts
diff --git a/src/content/matcher.ts b/src/content/matcher.ts
index ed817da..37aaaff 100644
--- a/src/content/matcher.ts
+++ b/src/content/matcher.ts
@@ -19,11 +19,13 @@ interface CandidateArticle {
   main_thesis: string;
   key_insights: string[];
   source_id: string;
+  match_strength: number;
 }
 
 export interface MatchedContext {
   readonly articleId: string;
   readonly sourceId: string;
+  readonly matchStrength: number;
   readonly connection: string;   // one sentence from cross-encoder
   readonly articleTitle: string;
 }
@@ -72,10 +74,11 @@ async function stage1BiEncoder(
   }
 
   // Sort by similarity DESC, take top 3 unique articles
-  const topArticleIds = [...bestByArticle.entries()]
+  const topMatches = [...bestByArticle.entries()]
     .sort((a, b) => b[1] - a[1])
     .slice(0, TOP_CANDIDATES)
-    .map(([id]) => id);
+    .map(([id, similarity]) => ({ id, matchStrength: similarity }));
+  const topArticleIds = topMatches.map((match) => match.id);
 
   if (topArticleIds.length === 0) return [];
 
@@ -88,7 +91,14 @@ async function stage1BiEncoder(
     throw new Error(`Failed to fetch candidate articles: ${articleError.message}`);
   }
 
-  return (articles ?? []) as CandidateArticle[];
+  const matchStrengthByArticleId = new Map(topMatches.map((match) => [match.id, match.matchStrength]));
+
+  return ((articles ?? []) as Array<Omit<CandidateArticle, 'match_strength'>>)
+    .map((article) => ({
+      ...article,
+      match_strength: matchStrengthByArticleId.get(article.id) ?? 0,
+    }))
+    .sort((a, b) => b.match_strength - a.match_strength);
 }
 
 /**
@@ -100,7 +110,7 @@ async function stage2CrossEncoder(
   finding: FindingInput,
   candidates: CandidateArticle[],
   aiClient: IAIClient,
-): Promise<{ articleId: string; sourceId: string; connection: string; title: string } | null> {
+): Promise<{ articleId: string; sourceId: string; matchStrength: number; connection: string; title: string } | null> {
   if (candidates.length === 0) return null;
 
   const candidateList = candidates
@@ -157,7 +167,7 @@ Respond as JSON array:
 function findStrongMatch(
   results: Array<{ candidate: number; strength: string; connection: string | null }>,
   candidates: CandidateArticle[],
-): { articleId: string; sourceId: string; connection: string; title: string } | null {
+): { articleId: string; sourceId: string; matchStrength: number; connection: string; title: string } | null {
   for (const result of results) {
     if (result.strength === 'strong' && result.connection) {
       const idx = result.candidate - 1;
@@ -166,6 +176,7 @@ function findStrongMatch(
         return {
           articleId: article.id,
           sourceId: article.source_id,
+          matchStrength: article.match_strength,
           connection: result.connection,
           title: article.title,
         };
@@ -231,12 +242,14 @@ export async function matchFindingsToArticles(
       logger.info('content.match.result', {
         finding: finding.moduleId,
         article: match.title,
+        match_strength: Number(match.matchStrength.toFixed(4)),
         connection: match.connection.slice(0, 80),
       });
 
       return {
         articleId: match.articleId,
         sourceId: match.sourceId,
+        matchStrength: match.matchStrength,
         connection: match.connection,
         articleTitle: match.title,
       };


--- src/content/scripts/content-cleanup-main.ts
diff --git a/src/content/scripts/content-cleanup-main.ts b/src/content/scripts/content-cleanup-main.ts
index 7ca4058..b3ff046 100644
--- a/src/content/scripts/content-cleanup-main.ts
+++ b/src/content/scripts/content-cleanup-main.ts
@@ -23,17 +23,60 @@ async function main(): Promise<void> {
 
   const db = createClient(supabaseUrl, supabaseKey);
 
-  // 1. Expire old content (45-day window, cascades to article_chunks)
+  // 1. Expire old content (45-day window, cascades to article_chunks).
+  // Protected sources are permanent corpus anchors and must survive cleanup.
   const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
-  const { error: expireError, count } = await db
+  const { data: protectedSources, error: protectedError } = await db
+    .from('content_sources')
+    .select('id')
+    .eq('is_protected', true);
+
+  if (protectedError) {
+    throw new Error(`Failed to load protected sources before cleanup: ${protectedError.message}`);
+  }
+
+  const protectedSourceIds = new Set(
+    (protectedSources ?? []).map((row) => (row as { id: string }).id),
+  );
+
+  const { data: oldRows, error: oldRowsError } = await db
     .from('content_items')
-    .delete({ count: 'exact' })
+    .select('id, source_id')
     .lt('week_of', cutoff);
 
-  if (expireError) {
-    logger.warn('content.cleanup.expire_error', { error: expireError.message });
+  if (oldRowsError) {
+    throw new Error(`Failed to load old content rows before cleanup: ${oldRowsError.message}`);
+  }
+
+  const expiredRows = (oldRows ?? []) as Array<{ id: string; source_id: string | null }>;
+  const idsToDelete = expiredRows
+    .filter((row) => row.source_id === null || !protectedSourceIds.has(row.source_id))
+    .map((row) => row.id);
+  const retainedProtected = expiredRows.length - idsToDelete.length;
+
+  if (idsToDelete.length === 0) {
+    logger.info('content.cleanup.expired', {
+      articles_deleted: 0,
+      retained_protected: retainedProtected,
+      protected_sources: protectedSourceIds.size,
+      cutoff,
+    });
   } else {
-    logger.info('content.cleanup.expired', { articles_deleted: count ?? 0, cutoff });
+    const { error: expireError } = await db
+      .from('content_items')
+      .delete()
+      .in('id', idsToDelete);
+
+    if (expireError) {
+      logger.warn('content.cleanup.expire_error', { error: expireError.message });
+    } else {
+      logger.info('content.cleanup.expired', {
+        articles_deleted: idsToDelete.length,
+        retained_protected: retainedProtected,
+        protected_sources: protectedSourceIds.size,
+        cutoff,
+      });
+    }
   }
 
   // 2. Source lifecycle evaluation
@@ -46,16 +89,16 @@ async function main(): Promise<void> {
     .eq('status', 'published')
     .not('edit_ratio', 'is', null);
 
-  const rows = (engagementData ?? []) as Array<{
+  const engagementRows = (engagementData ?? []) as Array<{
     ai_draft: string;
     edit_ratio: number | null;
     engagement_score: number | null;
   }>;
 
-  const withContext = rows.filter((r) => r.ai_draft.includes('<industry_context>'));
-  const withoutContext = rows.filter((r) => !r.ai_draft.includes('<industry_context>'));
+  const withContext = engagementRows.filter((r) => r.ai_draft.includes('<industry_context>'));
+  const withoutContext = engagementRows.filter((r) => !r.ai_draft.includes('<industry_context>'));
 
-  const avgEditRatio = (arr: typeof rows): number | null => {
+  const avgEditRatio = (arr: typeof engagementRows): number | null => {
     const vals = arr.map((r) => r.edit_ratio).filter((v): v is number => v !== null);
     return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
   };


--- src/content/source-evaluator.ts
diff --git a/src/content/source-evaluator.ts b/src/content/source-evaluator.ts
index af9d24e..ec42818 100644
--- a/src/content/source-evaluator.ts
+++ b/src/content/source-evaluator.ts
@@ -5,6 +5,7 @@ interface SourceRow {
   id: string;
   name: string;
   status: string;
+  is_protected: boolean;
   articles_evaluated: number;
   articles_passed: number;
   best_score_30d: number;
@@ -33,7 +34,7 @@ const MAX_FETCH_FAILURES = 5;
 export async function evaluateSourceLifecycle(db: SupabaseClient): Promise<void> {
   const { data, error } = await db
     .from('content_sources')
-    .select('id, name, status, articles_evaluated, articles_passed, best_score_30d, matched_count, added_at, fetch_failures')
+    .select('id, name, status, is_protected, articles_evaluated, articles_passed, best_score_30d, matched_count, added_at, fetch_failures')
     .in('status', ['active', 'probation', 'unreachable']);
 
   if (error) {
@@ -48,8 +49,14 @@ export async function evaluateSourceLifecycle(db: SupabaseClient): Promise<void>
   let toProbation = 0;
   let toDisabled = 0;
   let toUnreachable = 0;
+  let protectedSkipped = 0;
 
   for (const source of sources) {
+    if (source.is_protected) {
+      protectedSkipped++;
+      continue;
+    }
+
     const ageMs = now - new Date(source.added_at).getTime();
     const ageDays = ageMs / (1000 * 60 * 60 * 24);
     const hitRate = source.articles_evaluated > 0
@@ -108,7 +115,13 @@ export async function evaluateSourceLifecycle(db: SupabaseClient): Promise<void>
   // Expire old disabled sources back to active if they're still in reference repos
   // (implemented as manual override via sources.yml — not automated here)
 
-  logger.info('content.evaluator.done', { toActive, toProbation, toDisabled, toUnreachable });
+  logger.info('content.evaluator.done', {
+    toActive,
+    toProbation,
+    toDisabled,
+    toUnreachable,
+    protectedSkipped,
+  });
 }
 
 async function setStatus(


--- src/content/types.ts
diff --git a/src/content/types.ts b/src/content/types.ts
index d02a8ed..868543d 100644
--- a/src/content/types.ts
+++ b/src/content/types.ts
@@ -19,6 +19,7 @@ export interface ContentSource {
   readonly added_at: string;
   readonly disabled_at: string | null;
   readonly discovered_from: DiscoveredFrom | null;
+  readonly is_protected: boolean;
 }
 
 export interface ContentItem {
@@ -33,6 +34,7 @@ export interface ContentItem {
   readonly main_thesis: string;
   readonly key_insights: string[];
   readonly tech_concepts: string[];
+  readonly seed_modules: string[] | null;
   readonly quality_score: number;
   readonly times_matched: number;
   readonly title_hash: string;


--- src/main-poll.ts
diff --git a/src/main-poll.ts b/src/main-poll.ts
index 25a58bc..941d3e0 100644
--- a/src/main-poll.ts
+++ b/src/main-poll.ts
@@ -118,7 +118,14 @@ async function main(): Promise<void> {
 
       // Generate post (ONE Claude call — returns full post + Twitter short variant)
       const { bufferText, draftId } = await generatePosts(
-        anthropic, commit, findings, storage, config, recentModuleIds,
+        anthropic,
+        commit,
+        findings,
+        storage,
+        config,
+        recentModuleIds,
+        undefined,
+        { author_login: commit.authorLogin },
       );
 
       // Publish ONE Buffer Idea with both variants in the text


--- src/voice/sqlite-storage.ts
diff --git a/src/voice/sqlite-storage.ts b/src/voice/sqlite-storage.ts
index a846a82..4670180 100644
--- a/src/voice/sqlite-storage.ts
+++ b/src/voice/sqlite-storage.ts
@@ -42,16 +42,38 @@ export class SqliteStorage implements IVoiceStorage {
         scheduled_at    TEXT,
         status          TEXT NOT NULL DEFAULT 'pending',
         top_finding     TEXT,
+        top_module_id   TEXT,
         findings_count  INTEGER NOT NULL DEFAULT 0,
+        author_login    TEXT,
+        edit_analysis   TEXT,
+        context_status  TEXT,
+        has_industry_context INTEGER NOT NULL DEFAULT 0,
+        matched_article_id   TEXT,
+        matched_source_id    TEXT,
+        match_strength       REAL,
+        match_connection     TEXT,
         linkedin_urn    TEXT,
+        last_reactions_fetch_at TEXT,
         reactions_count INTEGER NOT NULL DEFAULT 0,
-        engagement_score REAL
+        engagement_score REAL,
+        publish_source  TEXT,
+        tenant_id       TEXT
       );
 
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id    TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login     TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis    TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status   TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context INTEGER NOT NULL DEFAULT 0;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id   TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id    TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength       REAL;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection     TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source   TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id        TEXT;
 
       CREATE UNIQUE INDEX IF NOT EXISTS idx_sha_platform
@@ -85,11 +107,30 @@ export class SqliteStorage implements IVoiceStorage {
   saveDraft(input: SaveDraftInput): Promise<string> {
     const id = randomUUID();
     this.db.prepare(`
-      INSERT INTO voice_posts (id, commit_sha, repo, platform, ai_draft, top_finding, top_module_id, findings_count, status, tenant_id)
-      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
-    `).run(id, input.commit_sha, input.repo, input.platform, input.ai_draft,
-           input.top_finding ?? null, input.top_module_id ?? null, input.findings_count ?? 0,
-           this.tenantId);
+      INSERT INTO voice_posts (
+        id, commit_sha, repo, platform, ai_draft, top_finding, top_module_id, findings_count,
+        author_login, context_status, has_industry_context, matched_article_id, matched_source_id,
+        match_strength, match_connection, status, tenant_id
+      )
+      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
+    `).run(
+      id,
+      input.commit_sha,
+      input.repo,
+      input.platform,
+      input.ai_draft,
+      input.top_finding ?? null,
+      input.top_module_id ?? null,
+      input.findings_count ?? 0,
+      input.author_login ?? null,
+      input.context_status ?? null,
+      input.has_industry_context ? 1 : 0,
+      input.matched_article_id ?? null,
+      input.matched_source_id ?? null,
+      input.match_strength ?? null,
+      input.match_connection ?? null,
+      this.tenantId,
+    );
     return Promise.resolve(id);
   }
 
@@ -107,10 +148,17 @@ export class SqliteStorage implements IVoiceStorage {
     this.db.prepare(`
       UPDATE voice_posts
       SET published = ?, edit_ratio = ?, published_at = ?, status = 'published',
-          linkedin_urn = COALESCE(?, linkedin_urn)
+          linkedin_urn = COALESCE(?, linkedin_urn),
+          publish_source = COALESCE(?, publish_source)
       WHERE id = ?
-    `).run(input.published, input.edit_ratio, input.published_at,
-           input.linkedin_urn ?? null, input.id);
+    `).run(
+      input.published,
+      input.edit_ratio,
+      input.published_at,
+      input.linkedin_urn ?? null,
+      input.publish_source ?? null,
+      input.id,
+    );
     return Promise.resolve();
   }
 


--- src/voice/storage.ts
diff --git a/src/voice/storage.ts b/src/voice/storage.ts
index 3ff82f6..a5cf513 100644
--- a/src/voice/storage.ts
+++ b/src/voice/storage.ts
@@ -1,5 +1,7 @@
 export type Platform = 'linkedin' | 'instagram';
 export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued';
+export type ContextStatus = 'skipped' | 'no_match' | 'matched';
+export type PublishSource = 'buffer' | 'linkedin_direct';
 
 export interface VoicePost {
   id: string;
@@ -15,10 +17,21 @@ export interface VoicePost {
   scheduled_at: string | null;
   status: PostStatus;
   top_finding: string | null;
+  top_module_id: string | null;
   findings_count: number;
+  author_login: string | null;
+  edit_analysis: Record<string, unknown> | null;
+  context_status: ContextStatus | null;
+  has_industry_context: boolean;
+  matched_article_id: string | null;
+  matched_source_id: string | null;
+  match_strength: number | null;
+  match_connection: string | null;
   linkedin_urn: string | null;
   reactions_count: number;
+  last_reactions_fetch_at: string | null;
   engagement_score: number | null;
+  publish_source: PublishSource | null;
 }
 
 export interface SaveDraftInput {
@@ -29,6 +42,13 @@ export interface SaveDraftInput {
   top_finding?: string;
   top_module_id?: string;
   findings_count?: number;
+  author_login?: string | null;
+  context_status?: ContextStatus | null;
+  has_industry_context?: boolean;
+  matched_article_id?: string | null;
+  matched_source_id?: string | null;
+  match_strength?: number | null;
+  match_connection?: string | null;
 }
 
 export interface UpdatePublishedInput {
@@ -37,6 +57,7 @@ export interface UpdatePublishedInput {
   edit_ratio: number;
   published_at: string;
   linkedin_urn?: string;  // extracted from Buffer externalLink when available
+  publish_source?: PublishSource;
 }
 
 export interface UpdateScheduledInput {


--- src/voice/supabase-storage.ts
diff --git a/src/voice/supabase-storage.ts b/src/voice/supabase-storage.ts
index 0a936a2..ba3de9a 100644
--- a/src/voice/supabase-storage.ts
+++ b/src/voice/supabase-storage.ts
@@ -31,6 +31,13 @@ export class SupabaseStorage implements IVoiceStorage {
         top_finding: input.top_finding ?? null,
         top_module_id: input.top_module_id ?? null,
         findings_count: input.findings_count ?? 0,
+        author_login: input.author_login ?? null,
+        context_status: input.context_status ?? null,
+        has_industry_context: input.has_industry_context ?? false,
+        matched_article_id: input.matched_article_id ?? null,
+        matched_source_id: input.matched_source_id ?? null,
+        match_strength: input.match_strength ?? null,
+        match_connection: input.match_connection ?? null,
         status: 'pending' satisfies PostStatus,
         tenant_id: this.tenantId,
       })
@@ -50,6 +57,7 @@ export class SupabaseStorage implements IVoiceStorage {
         published_at: input.published_at,
         status: 'published' satisfies PostStatus,
         ...(input.linkedin_urn !== undefined && { linkedin_urn: input.linkedin_urn }),
+        ...(input.publish_source !== undefined && { publish_source: input.publish_source }),
       })
       .eq('id', input.id);
 


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 3762a9a..00e308c 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -16,6 +16,7 @@ import { getInstallationToken } from './github-app-auth.js';
 import { logger } from '../utils/logger.js';
 import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
+import type { SaveDraftInput } from '../voice/storage.js';
 
 interface TenantRow {
   readonly id: string;
@@ -195,19 +196,52 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       // Content matching — inject industry context when a strong match is found.
       // Graceful degradation: any failure skips context, post generated normally.
       let industryContext: string | undefined;
+      let draftMetadata: Partial<SaveDraftInput> = {
+        author_login: commit.authorLogin,
+      };
       if (embedder) {
         try {
           const match = await matchFindingsToArticles(findings, embedder, anthropic, deps.db);
           if (match) {
             industryContext = `Connection: ${match.connection}`;
+            draftMetadata = {
+              ...draftMetadata,
+              context_status: 'matched',
+              has_industry_context: true,
+              matched_article_id: match.articleId,
+              matched_source_id: match.sourceId,
+              match_strength: match.matchStrength,
+              match_connection: match.connection,
+            };
             logger.info('content.match.injected', { sha: commit.sha, article: match.articleTitle });
+          } else {
+            draftMetadata = {
+              ...draftMetadata,
+              context_status: 'no_match',
+              has_industry_context: false,
+              matched_article_id: null,
+              matched_source_id: null,
+              match_strength: null,
+              match_connection: null,
+            };
           }
         } catch (err) {
           logger.warn('content.match.skipped', { sha: commit.sha, error: String(err) });
         }
+      } else {
+        logger.info('content.match.skipped', { sha: commit.sha, reason: 'no_embedder' });
       }
 
-      const { linkedinPost, bufferText, draftId } = await generatePosts(anthropic, commit, findings, storage, config, recentModuleIds, industryContext);
+      const { linkedinPost, bufferText, draftId } = await generatePosts(
+        anthropic,
+        commit,
+        findings,
+        storage,
+        config,
+        recentModuleIds,
+        industryContext,
+        draftMetadata,
+      );
 
       // Post directly to LinkedIn if connected
       if (tenant.linkedin_access_token && tenant.linkedin_member_id) {
@@ -219,6 +253,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
             published: linkedinPost,
             edit_ratio: 1.0,
             published_at: new Date().toISOString(),
+            publish_source: 'linkedin_direct',
           });
           logger.info('worker.commit.linkedin_posted', { sha: commit.sha });
         } catch (err) {

```

### Commit 6: afa2650
**Message:** feat: implement phase 3 progressive voice system

**Diff:**
```diff
--- .github/workflows/bootstrap-voice.yml
diff --git a/.github/workflows/bootstrap-voice.yml b/.github/workflows/bootstrap-voice.yml
index 01de730..554692b 100644
--- a/.github/workflows/bootstrap-voice.yml
+++ b/.github/workflows/bootstrap-voice.yml
@@ -19,13 +19,9 @@ jobs:
       - name: Install dependencies
         run: npm ci
 
-      - name: Write config
-        run: echo "$CONFIG_YAML" > config.yaml
-        env:
-          CONFIG_YAML: ${{ secrets.CONFIG_YAML }}
-
-      - name: Seed voice history from voice-bootstrap.md
+      - name: Store bootstrap exposure from voice-bootstrap.md
         env:
           SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
           SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
+          TENANT_ID: ${{ secrets.TENANT_ID }}
         run: npx tsx scripts/bootstrap-voice.ts


--- .github/workflows/deploy.yml
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index cbca72e..9bff63f 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -34,6 +34,9 @@ jobs:
       - name: Typecheck
         run: npm run typecheck
 
+      - name: Test
+        run: npm test
+
       - id: auth
         name: Authenticate to GCP
         uses: google-github-actions/auth@v2


--- .github/workflows/scan-sent-posts.yml
diff --git a/.github/workflows/scan-sent-posts.yml b/.github/workflows/scan-sent-posts.yml
index 9cda5d0..eb5ebbc 100644
--- a/.github/workflows/scan-sent-posts.yml
+++ b/.github/workflows/scan-sent-posts.yml
@@ -31,7 +31,7 @@ jobs:
 
       - name: Scan sent posts and update voice history
         env:
-          BUFFER_ACCESS_TOKEN: ${{ secrets.BUFFER_ACCESS_TOKEN }}
           SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
           SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
-        run: npx tsx src/main-scan.ts
+          GCP_KMS_KEY_NAME: ${{ secrets.GCP_KMS_KEY_NAME }}
+        run: npx tsx src/worker/main-scan-tenants.ts


--- README.md
diff --git a/README.md b/README.md
index a30d712..bea4de3 100644
--- a/README.md
+++ b/README.md
@@ -1,431 +1,164 @@
 # devcast
 
-> Turn every GitHub commit into a social media post — automatically, in your voice.
+> Turn GitHub commits into publishable LinkedIn and Buffer drafts, in the author's own voice.
 
-devcast monitors every commit you push across **all your GitHub repositories** and uses Claude AI
-to generate platform-native social media posts. You review drafts, edit them, and approve with
-a single comment. The system publishes to your Buffer queue — scheduled within your posting
-window — and stores your published text as training data for the next round of generation.
+`devcast` is a multi-tenant GitHub App. Each installation becomes a tenant. Pushes enqueue jobs, the worker analyzes commits with the 24-module pipeline, generates one post per interesting commit, and publishes either directly to LinkedIn or into Buffer Ideas. A scanner loop closes the feedback loop from published posts back into the voice system.
 
-**The AI gets better at sounding like you with every post you publish.**
-
-Built during a developer job search. The code is the portfolio.
-
----
-
-## How It Works
-
-```
-Your commits across all repos
-        ↓  (polls every 4h via GitHub Events API — account-level, no per-repo setup)
-Commit enrichment
-(diff analysis, file type detection, change classification)
-        ↓
-Trivial commits → weekly batch
-Interesting commits → Claude API
-        ↓
-Voice history retrieval
-(your 5 most recently published posts, weighted by how little you edited them)
-        ↓
-claude-sonnet-4-6 generates 3 platform-native drafts
-        ↓
-GitHub Issue opens for review
-(edit the issue body if needed, then comment /approve)
-        ↓
-Buffer schedules within 8am–7pm local window
-        ↓
-Published text stored in voice history
-(closes the self-training loop)
-```
-
----
-
-## Features
-
-| Feature | Details |
-|---|---|
-| **Install once** | GitHub Events API polling covers your entire account. New repos appear automatically. |
-| **Self-training voice** | AI improves with every post you publish — learns from your edits, not its own drafts |
-| **Human review required** | GitHub Issues inbox — no auto-publish path exists by design |
-| **Timezone-aware scheduling** | Posts only within 8am–7pm local time. Architecturally enforced. |
-| **Cost-minimal AI** | Batches trivial commits, caches all drafts, uses `claude-sonnet-4-6` |
-| **Buffer queue management** | Respects 10-post free tier limit, holds posts when full and retries |
-| **Free infrastructure** | GitHub Actions (public repo = unlimited minutes) + Supabase free tier |
-| **Forkable** | 8-step setup, documented credential flow, config template included |
-
----
-
-## Prerequisites
-
-- GitHub account with repos you want to monitor
-- [Buffer account](https://buffer.com) with LinkedIn/Twitter/Instagram channels connected
-- [Anthropic API key](https://console.anthropic.com) (only paid component — ~$0.006/post)
-- [Supabase account](https://supabase.com) (free tier, for voice history storage)
-
----
-
-## Setup — 8 Steps
+## Architecture
 
-### Step 1 — Fork and enable Actions
+Three Cloud Run runtimes share the same Docker image:
 
-Fork this repo to your GitHub account.
-Settings → Actions → "Allow all actions and reusable workflows"
+- `getdevcast-webhook`
+  Receives GitHub webhooks, serves onboarding at `/onboard`, and handles GitHub + LinkedIn OAuth callbacks.
+- `devcast-worker`
+  Claims jobs from `job_queue`, analyzes commits, matches content intelligence context, generates drafts, and publishes.
+- `devcast-scanner`
+  Scans Buffer sent posts, computes edit feedback, refreshes content preferences, and recalculates progressive voice state.
 
-### Step 2 — Create the database
+The canonical deploy path is:
 
-1. [supabase.com](https://supabase.com) → New project (free tier, pick any region)
-2. SQL Editor → paste contents of [`database/schema.sql`](database/schema.sql) → Run
-3. Settings → API → copy **Project URL** and **anon public key**
+`push to trunk` -> GitHub Actions -> Docker build -> Cloud Run deploy
 
-### Step 3 — Add secrets
+## Current Voice System
 
-Settings → Secrets and variables → Actions → New repository secret:
+Phase 3 uses the progressive voice subsystem from [`docs/voice-system-spec.md`](docs/voice-system-spec.md):
 
-| Secret | How to obtain |
-|---|---|
-| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key |
-| `BUFFER_ACCESS_TOKEN` | buffer.com → Settings → Apps → create app → complete OAuth → copy access token |
-| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
-| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
+- `cold`
+  baseline voice only
+- `bootstrap`
+  bootstrap posts are used as exposure examples
+- `warming`
+  published examples plus soft voice signals
+- `established`
+  full exposure + voice dice + opening variety guard
 
-**Getting a Buffer access token (detailed):**
-1. [buffer.com/developers/apps](https://buffer.com/developers/apps) → Create a new app
-2. App name: anything (e.g., "devcast"). Callback URL: `http://localhost`
-3. Note your Client ID and Client Secret
-4. Complete the OAuth authorization flow once to exchange for an access token
-5. Copy the token — it is long-lived (months before expiry)
+Bootstrap posts live in `voice_profiles.voice.bootstrap_posts`. Published posts feed `voice_examples_pool`, `voice_moves`, `recent_opening_sequence`, and `voice_summary`.
 
-### Step 4 — Configure
+## Local Commands
 
 ```bash
 npm install
-cp config.example.yaml config.yaml
-```
-
-Edit `config.yaml`:
-
-```yaml
-author:
-  github_username: "your-github-username"  # required
-  name: "Your Name"
-  website: "https://yoursite.com"          # appears in LinkedIn CTAs
-```
-
-### Step 5 — Link Buffer channels
-
-```bash
-npm run setup-buffer
-```
-
-Prints your connected Buffer channels with IDs. Paste into `config.yaml`:
-

--- database/migrations/2026-04-10-phase3-progressive-voice-verify.sql
diff --git a/database/migrations/2026-04-10-phase3-progressive-voice-verify.sql b/database/migrations/2026-04-10-phase3-progressive-voice-verify.sql
new file mode 100644
index 0000000..493b103
--- /dev/null
+++ b/database/migrations/2026-04-10-phase3-progressive-voice-verify.sql
@@ -0,0 +1,58 @@
+-- Verification for 2026-04-10 Phase 3 + progressive voice migration
+
+SELECT table_name
+FROM information_schema.tables
+WHERE table_schema = 'public'
+  AND table_name IN ('voice_profiles', 'voice_posts')
+ORDER BY table_name;
+
+SELECT column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND table_name = 'voice_posts'
+  AND column_name IN (
+    'tenant_id',
+    'top_module_id',
+    'author_login',
+    'edit_analysis',
+    'context_status',
+    'has_industry_context',
+    'matched_article_id',
+    'matched_source_id',
+    'match_strength',
+    'match_connection',
+    'linkedin_urn',
+    'reactions_count',
+    'engagement_score',
+    'last_reactions_fetch_at',
+    'publish_source',
+    'generation_system',
+    'opening_move'
+  )
+ORDER BY column_name;
+
+SELECT column_name
+FROM information_schema.columns
+WHERE table_schema = 'public'
+  AND table_name = 'voice_profiles'
+  AND column_name IN (
+    'tenant_id',
+    'github_author_login',
+    'voice',
+    'version',
+    'created_at',
+    'updated_at'
+  )
+ORDER BY column_name;
+
+SELECT indexname
+FROM pg_indexes
+WHERE schemaname = 'public'
+  AND indexname IN (
+    'idx_voice_profiles_tenant_default',
+    'idx_voice_profiles_tenant_author',
+    'idx_voice_profiles_tenant',
+    'idx_voice_posts_tenant',
+    'idx_voice_retrieval'
+  )
+ORDER BY indexname;


--- database/migrations/2026-04-10-phase3-progressive-voice.sql
diff --git a/database/migrations/2026-04-10-phase3-progressive-voice.sql b/database/migrations/2026-04-10-phase3-progressive-voice.sql
new file mode 100644
index 0000000..31eb107
--- /dev/null
+++ b/database/migrations/2026-04-10-phase3-progressive-voice.sql
@@ -0,0 +1,50 @@
+-- Phase 3 + progressive voice subsystem readiness
+-- Safe to run manually in Supabase SQL Editor.
+-- Idempotent: uses IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
+
+CREATE TABLE IF NOT EXISTS voice_profiles (
+  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  tenant_id            UUID NOT NULL REFERENCES tenants(id),
+  github_author_login  TEXT,
+  voice                JSONB NOT NULL DEFAULT '{}',
+  version              INTEGER NOT NULL DEFAULT 1,
+  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
+  ON voice_profiles(tenant_id)
+  WHERE github_author_login IS NULL;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
+  ON voice_profiles(tenant_id, github_author_login)
+  WHERE github_author_login IS NOT NULL;
+
+CREATE INDEX IF NOT EXISTS idx_voice_profiles_tenant
+  ON voice_profiles(tenant_id);
+
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id                 UUID REFERENCES tenants(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS top_module_id             TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login              TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS edit_analysis             JSONB;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS context_status            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS has_industry_context      BOOLEAN NOT NULL DEFAULT FALSE;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_article_id        UUID REFERENCES content_items(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS matched_source_id         UUID REFERENCES content_sources(id);
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength            REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection          TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn              TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count           INTEGER NOT NULL DEFAULT 0;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score          REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at   TIMESTAMPTZ;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source            TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system         TEXT DEFAULT 'v1';
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move              TEXT DEFAULT NULL;
+
+CREATE INDEX IF NOT EXISTS idx_voice_posts_tenant
+  ON voice_posts(tenant_id);
+
+DROP INDEX IF EXISTS idx_voice_retrieval;
+CREATE INDEX IF NOT EXISTS idx_voice_retrieval
+  ON voice_posts(platform, engagement_score DESC NULLS LAST, edit_ratio DESC NULLS LAST)
+  WHERE status = 'published';


--- database/schema.sql
diff --git a/database/schema.sql b/database/schema.sql
index ca27011..46451ae 100644
--- a/database/schema.sql
+++ b/database/schema.sql
@@ -14,15 +14,35 @@ CREATE TABLE IF NOT EXISTS voice_posts (
   published_at    TIMESTAMPTZ,
   buffer_post_id  TEXT,
   scheduled_at    TIMESTAMPTZ,             -- UTC time Buffer will publish
-  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'scheduled'|'published'|'queued'
+  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'scheduled'|'published'|'queued'|'expired'|'failed'
   top_finding     TEXT,                    -- headline of the top module finding
   findings_count  INTEGER NOT NULL DEFAULT 0,
   linkedin_urn    TEXT,                    -- urn:li:share:... captured from Buffer externalLink
   reactions_count INTEGER NOT NULL DEFAULT 0, -- LinkedIn reactions fetched from socialActions API
   engagement_score REAL,                  -- composite: edit_ratio*0.6 + normalized_reactions*0.4
+  generation_system TEXT,                 -- 'v1' | 'v2_progressive'
   tenant_id       UUID REFERENCES tenants(id) -- multi-tenant: scopes voice data per user
 );
 
+-- Per-tenant voice contract. One optional default row plus explicit author overrides.
+CREATE TABLE IF NOT EXISTS voice_profiles (
+  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  tenant_id            UUID NOT NULL REFERENCES tenants(id),
+  github_author_login  TEXT,                         -- NULL = tenant default
+  voice                JSONB NOT NULL DEFAULT '{}',
+  version              INTEGER NOT NULL DEFAULT 1,
+  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
+  ON voice_profiles(tenant_id)
+  WHERE github_author_login IS NULL;
+
+CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
+  ON voice_profiles(tenant_id, github_author_login)
+  WHERE github_author_login IS NOT NULL;
+
 -- Uninteresting commits saved for optional weekly roundup
 CREATE TABLE IF NOT EXISTS pending_batch (
   id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
@@ -199,6 +219,8 @@ ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_strength           REAL;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection         TEXT;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at  TIMESTAMPTZ;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source           TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system        TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move             TEXT;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS author_login             TEXT;
 
 ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS leased_until               TIMESTAMPTZ;
@@ -282,6 +304,7 @@ $$;
 -- The anon key is only safe for local dev with SQLite (see .env.example).
 
 ALTER TABLE voice_posts              ENABLE ROW LEVEL SECURITY;
+ALTER TABLE voice_profiles           ENABLE ROW LEVEL SECURITY;
 ALTER TABLE pending_batch            ENABLE ROW LEVEL SECURITY;
 ALTER TABLE events_state             ENABLE ROW LEVEL SECURITY;
 ALTER TABLE scheduled_slots          ENABLE ROW LEVEL SECURITY;
@@ -299,6 +322,8 @@ ALTER TABLE content_pipeline_runs    ENABLE ROW LEVEL SECURITY;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS linkedin_urn     TEXT;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS reactions_count  INTEGER NOT NULL DEFAULT 0;
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS engagement_score REAL;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system TEXT;
+ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move TEXT;
 
 ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_access_token     TEXT;
 ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_member_id        TEXT;
@@ -306,6 +331,7 @@ ALTER TABLE tenants ADD COLUMN IF NOT EXISTS linkedin_token_expires_at TIMESTAMP
 
 ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
 CREATE INDEX IF NOT EXISTS idx_voice_posts_tenant ON voice_posts(tenant_id);
+CREATE INDEX IF NOT EXISTS idx_voice_profiles_tenant ON voice_profiles(tenant_id);
 
 DROP INDEX IF EXISTS idx_voice_retrieval;
 CREATE INDEX IF NOT EXISTS idx_voice_retrieval


--- docs/devcast-spec.md
diff --git a/docs/devcast-spec.md b/docs/devcast-spec.md
index c227b89..38c042b 100644
--- a/docs/devcast-spec.md
+++ b/docs/devcast-spec.md
@@ -2296,6 +2296,9 @@ Audience is always manually selected by the user. The extractor may describe ton
 
 ## Runtime `voice_history` Selection
 
+> **Replaced by voice-system-spec.md** — §Voice Exposure (pool management, example selection, deduplication).
+> The `edit_ratio >= 0.70` gate and top-5 recency selection below are superseded by the progressive exposure pool when `voice.voice_moves` is present. Keep reading for legacy behavior (authors without `voice_moves`) and for the Loop 2/3/4 definitions that remain unchanged.
+
 `voice_history` remains the primary per-post quality driver, but it is now fully specified.
 
 **Phase 3 prerequisite:** this query is only valid once `voice_posts.author_login` is persisted for every generated draft. Without that column, org installs would mix multiple developers' voices in the same example pool. `top_module_id` must also be persisted before module diversification can work.
@@ -2350,6 +2353,9 @@ If no qualifying examples exist, omit the block entirely and rely on Tier 1 or T
 
 ## 3-Tier Voice System
 
+> **Replaced by voice-system-spec.md** — §Progressive Voice System (Stages 0–3), §Prompt builder integration.
+> The 3-tier fallback below (Tier 1 `style_patterns` → Tier 2 `TONE_INSTRUCTIONS` → Tier 3 baseline) is the legacy path used when `voice.voice_moves` is absent. When `voice.voice_moves` is present, `buildProgressiveVoiceBlocks()` takes over entirely. At Stage 3, `TONE_INSTRUCTIONS`, `RHYTHM_INSTRUCTIONS`, and `STRUCTURE_MAP` are all dropped — voice exposure examples and dice rolls encode the actual voice.
+
 **`buildSystemPrompt()` in this section [REPLACES CURRENT].**
 The prompt-builder behavior described in Implementation Status ("voice TOP + commit + findings + task BOTTOM") is the pre-Phase-3 state and must be fully replaced, not merged with this new contract.
 
@@ -2555,6 +2561,9 @@ TEACHING:
 
 ## Voice Extractor (`src/ai/voice-extractor.ts`)
 
+> **Replaced by voice-system-spec.md** — §Voice Moves Registry, §`voice-moves-calculator.ts`.
+> The Haiku extraction call below is superseded by statistical move measurement (zero AI calls) when `voice.voice_moves` is present. `voice-extractor.ts` continues to exist for the legacy path. New authors use the progressive system from day one.
+
 Haiku call. Two triggers:
 1. Bootstrap changed
 2. Scanner sees 5+ new published posts since `extracted_at`
@@ -2675,6 +2684,9 @@ The old loop only learned "how much was edited." Phase 3 uses four loops.
 
 ### Loop 1 — Style refresh (every 5 published posts)
 
+> **Replaced by voice-system-spec.md** — §Feedback Loops — Loop 1 (statistical move recalculation, zero AI calls).
+> The Haiku extractor input/output below is the legacy path. When `voice.voice_moves` is present, Loop 1 runs `refreshVoiceMoves()` instead: measures move frequencies against MOVES_REGISTRY, updates `voice.voice_moves` probabilities, refreshes the exposure pool, and computes `voice_summary` from move descriptions. Uses `edit_ratio >= 0.30` for pool eligibility (not 0.70 — see override table in voice-system-spec.md §What this spec replaces).
+
 Input:
 - up to 15 recent high-signal published posts (`edit_ratio >= 0.70`, `edit_type != 'rewrite'`, ordered by `published_at DESC`)
 - structured with signal quality, recency, and module metadata
@@ -2866,6 +2878,9 @@ Interpretation:
 
 ## Integration In `process-job.ts`
 
+> **Extended by voice-system-spec.md** — §Integration in `process-job.ts`.
+> The pseudocode below is the Phase 3 baseline. The voice spec adds: stage computation, `draftIndexToday` counter, exposure pool fetch, voice block assembly via `buildProgressiveVoiceBlocks()`, Opening Type Memory (variety constraint), Chapter Context System (skip-vs-chapter decision), and `generation_system = 'v2_progressive'` + `opening_move` persistence at draft-save time. The overall structure (fetch voice profile → filter findings → match articles → generate → publish) is unchanged.
+
 ```typescript
 const storedVoice = await storage.getVoiceProfile(tenant.id, commit.authorLogin);
 const voiceProfile = storedVoice?.voice ?? DEFAULT_VOICE_PROFILE;


--- docs/voice-system-spec.md
diff --git a/docs/voice-system-spec.md b/docs/voice-system-spec.md
new file mode 100644
index 0000000..5e73740
--- /dev/null
+++ b/docs/voice-system-spec.md
@@ -0,0 +1,2878 @@
+# devcast — Voice System Spec
+
+| Field | Value |
+|-------|-------|
+| Version | 1.14.3 |
+| Status | Design — replaces Phase 3 voice extraction subsystem and `anti-parrot-spec.md` |
+| Last updated | 2026-04-10 |
+| Owner | Liliana Castellanos / Vialabs Spa |
+| Parent spec | `devcast-spec.md` v1.5.17 — Phase 3 (Voice Profile + Content Strategy) |
+| Replaces | `anti-parrot-spec.md` v1.0.0 (entirely) |
+| Phase | Phase 3.5 — modifies Phase 3 voice subsystem, does not touch Phase 1 or Phase 2 |
+
+---
+
+## Changelog
+
+| Version | Date | Changes |
+|---------|------|---------|
+| 1.14.3 | 2026-04-10 | **All hard line-number references to master spec replaced with section-header anchors.** 19 references like `master spec line 2082` replaced with `master spec §computeEditRatio() contract`. Section headers do not shift when lines are added above them. Affects: authoritative references table, override table, VoiceProfile interface comment, bootstrap relationship comments, hashtag priority text, IVoiceStorage extension text, process-job pseudocode comments, emoji note, voice_summary section. No logic changes. |
+| 1.14.2 | 2026-04-10 | **`IVoiceStorage` exposure/moves contract resynchronized.** The `getPublishedForExposure()` signature had already been updated to include `platform`, but the surrounding storage section still implied both storage methods shared the same query shape. Fixed: (1) `getPublishedForExposure()` comment now clearly documents the per-platform filter as part of the method contract; (2) `getPublishedForMoves()` comment now explicitly documents the cross-platform query used by `refreshVoiceMoves()` — no `platform` parameter, no `platform` filter, `LIMIT 30`; (3) the “thin wrappers around those queries” note in Files affected is now unambiguous: exposure wraps the per-platform query, moves wraps the cross-platform query. This now matches both the Voice Exposure section and the Loop 1 algorithm. |
+| 1.14.1 | 2026-04-10 | **Exposure Pool docs aligned with platform-keyed storage.** The Voice Exposure chapter still described `voice.voice_examples_pool` as a flat `string[]` even though v1.14.0 had already changed the type and `process-job.ts` integration to platform-keyed storage. Fixed: (1) pool description now says `voice_examples_pool` is `{ linkedin?: string[]; instagram?: string[] }`; (2) `refreshExposurePool()` is explicitly documented as returning the pool for ONE platform, with `refreshVoiceMoves()` responsible for calling it per platform and storing the merged keyed object; (3) this now matches the master-spec requirement that runtime example selection preserves `platform` boundaries. |
+| 1.14.0 | 2026-04-10 | **Platform propagation — v1.9.0 fix completed.** v1.9.0 added `platform` param to `refreshExposurePool` signature but left 4 call sites desynchronized. Fixed: (1) `refreshVoiceMoves` now calls `refreshExposurePool` twice (linkedin + instagram) and merges into `pool = { linkedin, instagram }`; (2) `voice_examples_pool` type in VoiceProfile interface changed from `string[]` to `{ linkedin?: string[]; instagram?: string[] }` — per-platform keyed object; (3) `getPublishedForExposure` in IVoiceStorage extended with `platform: string` parameter; (4) `process-job.ts` integration reads `voice.voice_examples_pool?.[platform]` instead of the flat array. All three paths in `refreshVoiceMoves` (Path 1/2/3) now store the keyed structure. |
+| 1.13.0 | 2026-04-10 | **Path 2 comment fixed — same spread behavior as Path 1.** Path 2 (`warming`) had the same misleading `// voice_moves deliberately NOT set` comment as Path 1 before v1.10.0. Replaced with accurate documentation: spread preserves existing `voice_moves` by design (same rationale as Path 1 — calibrated dice survive a transient regression). Key addition: documents that preserved `voice_moves` are **inert during Stage 2** — `buildProgressiveVoiceBlocks` only injects `<voice_moves>` at `stage === 'established'`. Stale dice sit in JSONB but produce no prompt output until Stage 3 is re-reached and Path 3 recalibrates them. Not a memory leak — bounded and self-healing. |
+| 1.12.0 | 2026-04-10 | **Contradictory edit_ratio text fixed.** Stage 2 section said "`edit_ratio` is NOT used as a filter" immediately before "posts with ratio < 0.30 are excluded" — which is a filter. Rewritten to accurately describe the system: a weight with a minimum floor (0.30 hard exclusion for total rewrites, graded weights above that). Added explicit contrast with the master spec's 0.70 hard gate and the rationale for why exposure needs different logic than extraction. |
+| 1.11.0 | 2026-04-10 | **Runtime bug fix in `buildVoiceBlocks` decision guard.** Changed `||` to `&&` in the progressive path condition. With `||`, a Stage 3 author who purges their published history would throw at runtime: `countUniquePublished` drops to 0 → stage becomes `'cold'` → Path 1 preserves `voice_moves` (intentional) → `voice_moves` truthy + `||` routes to `buildProgressiveVoiceBlocks` → function throws on `stage='cold'`. With `&&`, stage `'cold'` always routes to legacy path regardless of `voice_moves` state. Preserved stale dice wait for data recovery; Path 3 overwrites when posts accumulate again. |
+| 1.10.0 | 2026-04-10 | **Path 1 regression behavior declared.** Replaced misleading `// voice_moves deliberately NOT set` comment with explicit documentation: the spread preserves existing `voice_moves` intentionally when an author falls back to Path 1 (e.g., deleted posts, scanner gap). An author who previously reached Stage 3 keeps their calibrated dice during the transient minimum. Path 3 overwrites when data recovers. Stale calibrated voice > no voice for a transient minimum. |
+| 1.9.0 | 2026-04-10 | **Platform architecture decision.** Eliminated `social_platforms: string[]` from `MoveDefinition` interface and all 44 registry entries — field was declared but never consumed anywhere in the spec. Replaced by an explicit architectural rule: exposure pool (`refreshExposurePool`) is per-platform (added `platform` parameter and `.eq('platform', platform)` filter); move measurement (`refreshVoiceMoves`) and stage computation are cross-platform (added explicit no-filter comment explaining why). Override table row added documenting the split decision and the removal of `MoveDefinition.social_platforms`. |
+| 1.8.0 | 2026-04-10 | **Cross-spec consistency pass.** Override table extended with 7 new rows: (1) Loop 1 `edit_ratio` threshold rationale (0.30 for exposure/moves, 0.70 remains for Loop 4 — different purposes, not a conflict); (2) Stage 3 drops `TONE_INSTRUCTIONS` + `RHYTHM_INSTRUCTIONS` + `STRUCTURE_MAP` explicitly (not just `style_patterns`/`voice_devices`); (3) Chapter Context System skip logic added as override (master has no commit skip based on module saturation); (4) Opening Type Memory (`opening_move` column, `recent_opening_sequence`, `<variety_constraint>` block) documented as pure addition; (5) Chapter Context System (`getRecentTopFindings`, `buildChapterContext`, `<chapter_context>` block) documented as pure addition; (6) `generation_system` column documented as pure addition. `getRecentTopFindings()` added to `IVoiceStorage` extension block. Master spec (`devcast-spec.md`) updated with `> Replaced by voice-system-spec.md` notices at §Runtime voice_history Selection, §3-Tier Voice System, §Voice Extractor, §Loop 1, §Integration In process-job.ts. |
+| 1.7.0 | 2026-04-09 | **Scanner corruption guard.** `refreshExposurePool` deduplication comment expanded with full root-cause explanation: the sent-scanner can assign the same Buffer published post to multiple `voice_posts` rows (different `commit_sha`, identical `published` text) when two drafts are similar. The application-level dedup by `LEFT(published, 80)` is the last defense before examples reach Claude — documented as intentional, not incidental. Null-safety fixes: `published.data ?? []` and explicit `as string` casts. |
+| 1.6.0 | 2026-04-09 | **Chapter Context System.** Added skip-vs-chapter decision in `process-job.ts` before Claude call: if top module `fireCount >= 2` AND `draftIndexToday > 0` → skip commit (log `module_saturation`); otherwise → chapter mode. Added `getRecentTopFindings(authorLogin, moduleId, limit)` to `IVoiceStorage` and `SupabaseStorage`. Added `buildChapterContext()` in `src/ai/prompt-builder.ts` — injects `<chapter_context>` into the USER prompt (after `<findings>`, before `<task>`) when the module has prior published history. Chapter number = `fireCount + 1`. Replaces the vague `<module_variety_hint>` framing when chapter context is available — both can coexist. No new DB columns needed. |
+| 1.5.0 | 2026-04-09 | **Opening Type Memory.** Added `voice_posts.opening_move` column (detected at draft-save time). Added `voice.recent_opening_sequence` (last 5 published opening types, computed in Loop 1). Added `detectOpeningMove()` helper in `src/voice/exposure.ts`. Added `buildVarietyConstraint()` in `src/ai/prompt-builder.ts`: injects `<variety_constraint>` block when same-day posts repeat an opening type or when the last 3 posts all used the same opening. Constraint active from Stage 1 onward — does not require dice or Stage 3. Updated `process-job.ts` integration: fetches today's first draft opening type when `draftIndexToday > 0`. Updated block order to place `<variety_constraint>` between `<preferences>` and `<voice_signals>`. Updated "What this spec does not do" to clarify anti-repetition at phrase level vs structural level. |
+| 1.4.0 | 2026-04-09 | `refreshVoiceMoves` restructured into 3 explicit paths: (Path 1) insufficient data — persists stage + pool + proto-summary without voice_moves, (Path 2) Stage 2 warming — persists proto-summary + pool + hashtags without dice, (Path 3) Stage 3 established — full move measurement + smoothing + dice summary. `computeProtoSummary` defined: derives voice_summary from coarse signals (length, opening register, hashtags) for Stage 2 UI. Upsert of author-specific row moved before stage computation. Override table header now includes explicit acceptance declaration. |
+| 1.3.0 | 2026-04-09 | **Five consistency fixes.** (A) `StoredVoiceProfile` / `DEFAULT_VOICE_PROFILE` unwrapping made explicit in process-job: `stored = getVoiceProfile()`, `voice = stored?.voice ?? DEFAULT_VOICE_PROFILE`, `voiceVersion = stored?.version ?? 0`. No more ambiguous `?? DEFAULT` comment. (B) `refreshVoiceMoves` now checks for author-specific `voice_profiles` row and creates one (seeded from tenant default) if it doesn't exist, before persisting moves. Prevents silent no-op when author only has tenant-default fallback. (C) Emoji rule removed from `<never>` hard rules — stays in Layer 2 as master spec defines (line 2408). Added explicit note that emojis in exposure examples are correct Layer 3 behavior. (D) `voice_summary` defined: computed on-write during Loop 1 from top-3 measured move descriptions, stored in same `voice.voice_summary` field the master spec uses. No UI change needed. Added to override table. (E) `computeVoiceStage` in `refreshVoiceMoves` now uses `countUniquePublished()` (all published, no edit_ratio filter) instead of the quality-filtered `posts.length`. Smoothing loop dead code removed. |
+| 1.2.0 | 2026-04-09 | **Master spec alignment fixes (9 issues).** (1) New fields live inside `voice JSONB` as VoiceProfile interface extensions, not as top-level columns — no ALTER TABLE on voice_profiles. (2) All voice_profiles queries use `github_author_login` (matching master), voice_posts queries use `author_login`. (3) Pseudocode reads `voice.voice_moves`, `voice.bootstrap_posts` consistently from JSONB. (4) IVoiceStorage extension follows master's parameter pattern with tenant-scoping note. (5) `generation_system` marking matches activation: v2_progressive for all progressive stages (1–3), not just when voice_moves exists. (6) `draftIndexToday` uses `existingDraft.created_at` on retry in both the utility section and process-job pseudocode. (7) Override table expanded with master spec section references and conflict resolution rationale for edit_ratio 0.30 and `<never>` block changes. (8) Hashtag priority defined: `voice.hashtags` + `hashtags_mode` (user-configured) wins over `always_hashtags` (auto-detected); always_hashtags is additive only. (9) Bootstrap relationship clarified: `tenants.voice_bootstrap` stays raw input per master §voice_profiles table, `voice.bootstrap_posts` is parsed array. |
+| 1.1.0 | 2026-04-09 | Registry validation procedure (20 writers, 4 criteria, 6-step process). Utility function contracts (FNV-1a hash, Mulberry32 RNG, exponential-sort weighted shuffle). `draftIndexToday` computation and retry semantics. `analyze-voice.ts` and `validate-registry.ts` script contracts. `buildProgressiveVoiceBlocks` full implementation with per-stage assembly logic. `buildVoiceSignals` for Stage 2 proto-moves. `process-job.ts` integration pseudocode. Loop 2/3/4 interaction clarified. Helper functions (`syntheticVoicePost`, `moduleIdToLabel`, `countUniquePublished`). Prompt length budget (4000 chars). Bootstrap post deletion behavior. Reference writer list expanded from 8 to 20. Files affected updated. Weighted shuffle call signature corrected in `selectExposureExamples`. |
+| 1.0.0 | 2026-04-09 | Initial spec. Progressive Voice System with 4 stages, Voice Exposure, Voice Dice, MOVES_REGISTRY with 42 entries validated against 12 published posts and 8 reference writers. |
+
+---
+
+## Why this exists
+
+Phase 3 of the master spec captures the developer's voice by extracting `style_patterns` (400 chars) and `voice_devices` (300 chars) via a Haiku call, then injecting those compressed descriptions as instructions into the generation prompt. This produces accurate voice replication for the first 5–10 posts. After that, a self-reinforcing loop degrades quality:
+
+1. The compressed extraction destills the author's tics into rigid rules ("Frases cortas. Cierra con lección. Usa metáforas de cocina.")
+2. The model obeys those rules literally in every generation
+3. New posts trained on the same rules reinforce the same patterns
+4. The author's voice stops varying — every post opens the same way, closes the same way, uses the same rhetorical moves
+
+**Measured evidence from production data (94 voice_posts, 12 unique LinkedIn published, 39 scheduled drafts):**
+
+| Signal | Published freq | Draft freq | Ratio | Interpretation |
+|--------|---------------|------------|-------|----------------|
+| `em_dash` (—) | 8% | 82% | 10.2× | AI massively overuses |
+| `"I'm building [X]"` context | 8% | 64% | 8.0× | AI massively overuses |
+| `opens_with_number` | 17% | 54% | 3.2× | AI overuses (also violates `<never>` block) |
+| `"zero removed/deleted"` | 0% | 26% | ∞ | AI invented this — user never uses it |
+| `inline_code` in post | 0% | 18% | ∞ | AI invented this — user never uses it |
+| `"very X. very Y."` | 67% | 69% | 1.0× | Correct — matches user's real frequency |
+| `"frankly"` | 42% | 38% | 0.9× | Correct |
+| `self_deprecating` | 50% | 49% | 1.0× | Correct |
+
+The problem is not that the AI uses the author's tics — it's that it uses some tics 10× more often than the author does, invents tics the author never uses, and applies all tics to every post instead of varying them naturally.
+
+**Additional structural finding:** the author's median `edit_ratio` is 0.47. Phase 3 uses `edit_ratio >= 0.70` as the quality gate for voice training. This discards 13 of 17 published posts, leaving only 4 posts as training signal. The system is starving itself of its own best data.
+
+This spec replaces the compressed voice extraction with a **Progressive Voice System** that:
+
+1. Shows the model examples of the author's writing directly (voice exposure) instead of compressed rules
+2. Uses a measured, probabilistic catalog of the author's voice moves (voice dice) instead of prescriptive instructions
+3. Progresses through 4 stages as data accumulates, never pretending to know more than it does
+4. Eliminates the Haiku extraction call entirely — the voice is measured statistically, not extracted by AI
+
+---
+
+## What this spec replaces
+
+### In `devcast-spec.md` (Phase 3)
+
+This spec **overrides** the following sections of the master spec. The master spec remains authoritative for everything not listed here. Each override references the specific master spec location it contradicts.
+
+**All overrides in this table have been reviewed and accepted as intentional divergences from the master spec.** They are not bugs or omissions — each one has a measured rationale documented in the "Conflict resolution" column. An implementor should treat them as authoritative for the scope of this spec.
+
+| Master spec section | Line/ref | Override | Conflict resolution |
+|---|---|---|---|
+| `voice-extractor.ts` — Haiku call to extract `style_patterns` + `voice_devices` | §Voice Extractor | Replaced by `voice-moves-calculator.ts` (statistical measurement, zero AI calls) | voice-extractor.ts continues to exist for legacy path; new system bypasses it |
+| `prompt-builder.ts` — Tier 1 voice block injection (`<voice_patterns>`, `<voice_devices>`) | §3-Tier Voice System | Replaced by `<voice_exposure>` + `<voice_moves>` blocks | Legacy blocks injected when `voice.voice_moves` is absent; new blocks when present |
+| `voice_history` selection — `edit_ratio >= 0.70` exclusion gate | §Runtime voice_history Selection | For voice exposure (example selection): `edit_ratio >= 0.30` with weighting. For Loop 4 (feedback scoring): `edit_ratio >= 0.70` unchanged. | Two different uses of edit_ratio have different thresholds. The master's 0.70 was designed for extraction training data quality; exposure uses 0.30 because the published text IS the author's voice regardless of how much they edited |
+| `voice_history` selection — `platform = $3` filter | §Runtime voice_history Selection | Split by layer: **exposure pool** (`refreshExposurePool`) is per-platform — Claude sees examples in the same format it will generate. **Move measurement** (`refreshVoiceMoves`) is cross-platform — the author's stylistic moves are not platform-specific and filtering by platform would halve the signal. **Stage computation** (`computeVoiceStage`) is cross-platform — the author's total publication history determines maturity. `MoveDefinition.social_platforms` field removed entirely — the registry treats all moves as platform-universal. | Format matters for example selection (LinkedIn ≠ Instagram in length and structure). Voice patterns do not vary by platform for the same author. |
+| `voice_history` selection — deterministic top-5 by recency | §Runtime voice_history Selection | Randomized selection within quality filter, commit-seeded for reproducibility | Master's deterministic recency selection caused the same examples to appear for weeks |
+| Loop 1 — Haiku refresh every 5 publications | §Loop 1 — Style refresh | Replaced by statistical recalculation of move probabilities (zero AI calls) | Only when `voice.voice_moves` is present; authors without it still use Haiku refresh |
+| `VoiceProfile` interface — `style_patterns`, `voice_devices` fields | §VoiceProfile JSONB contract | Extended with `voice_moves`, `voice_stage`, `voice_examples_pool`, `always_hashtags`, `bootstrap_posts` inside same `voice` JSONB. Existing fields NOT removed. | Prompt-builder reads old fields when `voice_moves` absent, new fields when present |
+| `<never>` block — `"No lead with counts or quantities"` hard rule | §Rule Layers > Layer 1 | Moved to voice dice as `opens_with_number` with probability ~0.10 — no longer a hard rule | Production data shows the author uses number openings 17% of the time. A hard ban contradicts their real voice. The dice makes it rare (~10%) instead of forbidden. Platform-safety rules remain in `<never>` |
+| Onboarding bootstrap — Haiku extraction from pasted posts | §/settings/voice — Org member setup | Replaced by direct storage as `voice.bootstrap_posts` array (no extraction) | `tenants.voice_bootstrap` remains the raw textarea input per master spec §voice_profiles table. The parsed array lives in `voice_profiles.voice.bootstrap_posts` |
+| `voice_summary` — Haiku-generated UI summary | §VoiceProfile JSONB contract, §Voice Extractor | Replaced by computed summary from measured move descriptions during Loop 1 | Same field, different producer. Legacy authors keep Haiku-generated summary; progressive authors get computed summary. No UI change needed |
+| Loop 1 — `edit_ratio >= 0.70` input filter | §Loop 1 — Style refresh | Loop 1 is wholly replaced by statistical move measurement. The new Loop 1 uses `edit_ratio >= 0.30` for the exposure pool (showing examples) and no threshold filter for move frequency counting (all published posts count toward pattern frequency). The 0.70 threshold was the Haiku extractor's quality gate — it needed high-signal input to extract style rules. Statistical counting does not need that gate: a post with `edit_ratio = 0.45` still published with its moves intact. Loop 4 retains `edit_ratio >= 0.70` unchanged. | The two thresholds serve different purposes and coexist without conflict. |
+| Prompt builder — Tier 2 `TONE_INSTRUCTIONS` + `RHYTHM_INSTRUCTIONS` + `STRUCTURE_MAP` blocks | §3-Tier Voice System, §Tone And Structure | Tier 2 blocks are used only for Stages 0–1 (cold/bootstrap) via the legacy path. From Stage 2 onward, `<voice_signals>` replaces them. At Stage 3, all three are dropped entirely — voice exposure examples and voice moves already encode the author's actual tone, rhythm, and narrative shape. TONE_INSTRUCTIONS apply when the user configured a preference but has no published history yet. Once history exists, the examples are authoritative and static instructions add noise. | Already partially covered by the `<voice_patterns>/<voice_devices>` row above; this row makes the TONE/RHYTHM/STRUCTURE drop explicit. |
+| `process-job.ts` — commit pipeline has no module-saturation skip logic | §Integration In process-job.ts | Chapter Context System (§Chapter Context System) adds a skip-vs-chapter decision before the Claude call: if `top_module_id` has `fireCount >= 2` AND `draftIndexToday > 0`, skip the commit and log `module_saturation`. If `fireCount >= 1` AND `draftIndexToday = 0`, chapter mode activates instead. Master spec pipeline has no such skip. | The skip prevents variety collapse when a module fires repeatedly on the same day. It does not skip across days — only within a single generation session (same tenant, same author, same calendar day). |
+| Opening Type Memory — not in master spec | New | `voice_posts.opening_move TEXT DEFAULT NULL` column added to track the structural opening type of each generated draft. `voice.recent_opening_sequence: string[]` field added to VoiceProfile JSONB — last 5 published opening types, computed in Loop 1. `<variety_constraint>` block injected in the system prompt from Stage 1 onward when the same-day or last-3-posts opening pattern repeats. `detectOpeningMove()` classifies the draft opening at save time. | Pure addition — no master spec behavior is changed. The constraint block is injected between `<preferences>` and `<voice_signals>` in the prompt block order. |
+| Chapter Context System — not in master spec | New | `getRecentTopFindings(authorLogin, moduleId, limit)` added to `IVoiceStorage`. `buildChapterContext()` added to prompt-builder — injects `<chapter_context>` in the user prompt (after `<findings>`, before `<task>`) when the module has prior published history. Chapter number = `fireCount + 1`. Replaces the vague `<module_variety_hint>` framing when chapter context is available. | Pure addition. `<module_variety_hint>` remains for cases where chapter context is absent. |
+| `voice_posts.generation_system` column — not in master spec | New | New column tracking which generation system produced each draft: `'v1'` (current production, pre-voice-spec) or `'v2_progressive'` (this spec). Written at draft-save time in `process-job.ts`. Used to segment analytics and rollback detection. | Pure addition. Already applied to `database/schema.sql` via `ALTER TABLE IF NOT EXISTS`. |
+
+### `anti-parrot-spec.md`
+
+Entirely replaced. Of the 4 mechanisms:
+
+| Mechanism | Status |
+|---|---|
+| 1 — Anti-repetition memory | Eliminated. Voice dice + voice exposure cover this by design. |
+| 2 — Voice observations | Eliminated. Voice moves replaces compressed extraction entirely. |
+| 3 — Voice history rotation | **Absorbed** into this spec (Section: Voice Exposure). |
+| 4 — Structure breaks | Eliminated. Shape variation emerges from diverse examples + dice roll. |
+
+### What is NOT overridden
+
+Everything else in Phase 3 stays as-is:
+
+- `ContentStrategy` (content_preferences, audience, platform rules)
+- `<never>` block for platform-safety rules (no LinkedIn headers, no engagement-bait questions, no code blocks)
+- Loops 2, 3, 4 (edit analysis, discouraged hooks, industry context preference)
+- `STRUCTURE_MAP[tone]` and `TONE_INSTRUCTIONS[tone]` (used in Stages 0–1 only)
+- `voice_posts` table and state machine
+- `process-job.ts` integration flow (modified to call new voice system, but same overall structure)
+- `IVoiceStorage` contract (extended, not replaced)
+- Optimistic locking on `voice_profiles.version`
+
+---
+
+## Authoritative references (do not redefine)
+
+| Item | Source |
+|------|--------|
+| `voice_posts` schema and state machine | master spec |
+| `computeEditRatio()` tokenization contract | master spec §`computeEditRatio()` contract |
+| `ContentStrategy` and `content_preferences` | master spec §`VoiceProfile` JSONB contract |
+| `<never>` block (platform-safety subset only) | master spec §Rule Layers > Layer 1 |
+| `STRUCTURE_MAP[tone]` | master spec §Tone And Structure |
+| `IVoiceStorage` base interface | master spec §Individual Voice, Always > Storage contract |
+| `process-job.ts` integration points | master spec |
+| Loop 2, 3, 4 logic | master spec |
+| `IEmbedder`, `IAIClient` interfaces | master spec |
+
+If anything in this document conflicts with the master spec on an item NOT listed in the "What this spec replaces" section, the master spec wins.
+
+---

--- package.json
diff --git a/package.json b/package.json
index eb0cd31..6457090 100644
--- a/package.json
+++ b/package.json
@@ -8,17 +8,20 @@
     "setup-linkedin": "tsx --env-file=.env.local scripts/setup-linkedin.ts",
     "update-engagement": "tsx --env-file=.env.local scripts/update-engagement.ts",
     "bootstrap": "tsx --env-file=.env.local scripts/bootstrap-voice.ts",
+    "voice:analyze": "tsx --env-file=.env.local scripts/analyze-voice.ts",
+    "voice:validate-registry": "tsx --env-file=.env.local scripts/validate-registry.ts",
     "test-analyze": "tsx --env-file=.env.local scripts/test-analyze.ts",
     "webhook": "tsx --env-file=.env.local src/webhook/server.ts",
     "worker": "tsx --env-file=.env.local src/worker/main-worker.ts",
     "poll": "tsx --env-file=.env.local src/main-poll.ts",
-    "scan": "tsx --env-file=.env.local src/main-scan.ts",
+    "scan": "tsx --env-file=.env.local src/worker/main-scan-tenants.ts",
+    "scan:legacy": "tsx --env-file=.env.local src/main-scan.ts",
     "gen-image-prompt": "tsx --env-file=.env.local scripts/gen-image-prompt.ts",
     "seed-corpus:extract": "tsx --env-file=.env.local scripts/seed-corpus/extract-text.ts",
     "seed-corpus:validate": "tsx --env-file=.env.local scripts/seed-corpus/validate.ts",
     "seed-corpus:seed": "tsx --env-file=.env.local scripts/seed-corpus/seed.ts",
     "rotate-tenant-tokens": "tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts",
-    "test": "vitest run",
+    "test": "vitest run --passWithNoTests",
     "typecheck": "tsc --noEmit"
   },
   "dependencies": {


--- scripts/analyze-voice.ts
diff --git a/scripts/analyze-voice.ts b/scripts/analyze-voice.ts
new file mode 100644
index 0000000..c4b5a05
--- /dev/null
+++ b/scripts/analyze-voice.ts
@@ -0,0 +1,74 @@
+import { readFileSync } from 'fs';
+import { createClient } from '@supabase/supabase-js';
+import { calibrateMoveProbability } from '../src/voice/dice.js';
+import { MOVES_REGISTRY } from '../src/voice/moves-registry.js';
+import { computeVoiceStage } from '../src/voice/stage.js';
+import { SupabaseStorage } from '../src/voice/supabase-storage.js';
+
+interface InputPost {
+  text?: string;
+  published?: string;
+}
+
+function getArg(name: string): string | undefined {
+  const idx = process.argv.indexOf(name);
+  return idx >= 0 ? process.argv[idx + 1] : undefined;
+}
+
+async function loadTexts(): Promise<string[]> {
+  const file = getArg('--file');
+  if (file) {
+    const raw = JSON.parse(readFileSync(file, 'utf8')) as InputPost[];
+    return raw.map((entry) => entry.text ?? entry.published ?? '').filter(Boolean);
+  }
+
+  const tenantId = getArg('--tenant');
+  const authorLogin = getArg('--author');
+  if (!tenantId || !authorLogin) {
+    throw new Error('Use --file <json> or --tenant <id> --author <login>.');
+  }
+
+  const url = process.env['SUPABASE_URL'] ?? '';
+  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
+  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for tenant mode.');
+
+  const storage = new SupabaseStorage(url, key, tenantId);
+  const posts = await storage.getPublishedForMoves(authorLogin);
+  return posts.map((post) => post.published ?? '').filter(Boolean);
+}
+
+async function main(): Promise<void> {
+  const texts = await loadTexts();
+  if (texts.length === 0) {
+    console.log(JSON.stringify({ total_posts: 0, active_moves: [], top_moves: [] }, null, 2));
+    return;
+  }
+
+  const frequencies = MOVES_REGISTRY
+    .filter((move) => move.regex)
+    .map((move) => {
+      const matches = texts.filter((text) => move.regex!.test(text)).length;
+      return {
+        id: move.id,
+        matches,
+        frequency: matches / texts.length,
+        calibrated_probability: calibrateMoveProbability(matches, texts.length),
+        description: move.description,
+      };
+    })
+    .sort((left, right) => right.frequency - left.frequency);
+
+  const result = {
+    total_posts: texts.length,
+    stage: computeVoiceStage(texts.length, false),
+    active_moves: frequencies.filter((move) => move.calibrated_probability > 0),
+    top_moves: frequencies.slice(0, 10),
+  };
+
+  console.log(JSON.stringify(result, null, 2));
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});


--- scripts/bootstrap-voice.ts
diff --git a/scripts/bootstrap-voice.ts b/scripts/bootstrap-voice.ts
index d78a04a..c4e39fd 100644
--- a/scripts/bootstrap-voice.ts
+++ b/scripts/bootstrap-voice.ts
@@ -1,103 +1,115 @@
 /**
- * bootstrap-voice.ts — seeds voice history from voice-bootstrap.md
+ * bootstrap-voice.ts — stores bootstrap posts as voice exposure, not published history
  *
  * Usage: npm run bootstrap
- * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or uses SQLite locally)
+ * Requires: TENANT_ID for Supabase mode. SQLite defaults to local tenant.
  */
 
 import { readFileSync } from 'fs';
-import { randomUUID } from 'crypto';
-import { SupabaseStorage } from '../src/voice/supabase-storage.js';
+import { createClient } from '@supabase/supabase-js';
+import { DEFAULT_VOICE_PROFILE } from '../src/config/schema.js';
+import type { BootstrapPost, VoiceProfile } from '../src/config/schema.js';
 import { SqliteStorage } from '../src/voice/sqlite-storage.js';
-import type { IVoiceStorage, Platform } from '../src/voice/storage.js';
+import { SupabaseStorage } from '../src/voice/supabase-storage.js';
+import { mergeVoiceProfile } from '../src/voice/profile-utils.js';
 
-interface BootstrapPost {
-  module?: string;
-  platform: Platform;
-  training_weight: number;
-  voice_notes?: string;
+interface ParsedBootstrapPost {
   text: string;
 }
 
-function parseBootstrapFile(content: string): BootstrapPost[] {
-  const posts: BootstrapPost[] = [];
-  const blocks = content.split(/^---\s*$/m).filter(b => b.trim());
+function parseBootstrapFile(content: string): ParsedBootstrapPost[] {
+  const posts: ParsedBootstrapPost[] = [];
+  const blocks = content.split(/^---\s*$/m).filter((block) => block.trim());
 
   for (const block of blocks) {
     const lines = block.trim().split('\n');
-    const meta: Record<string, string> = {};
     const textLines: string[] = [];
     let inText = false;
 
     for (const line of lines) {
-      if (!inText && line.startsWith('#')) continue; // skip section headers
+      if (!inText && line.startsWith('#')) continue;
       const metaMatch = line.match(/^\*\*(\w+(?:_\w+)*)\*\*:\s*(.+)$/);
-      if (!inText && metaMatch) {
-        meta[metaMatch[1]!.toLowerCase()] = metaMatch[2]!.trim();
-      } else if (line.trim() || inText) {
+      if (!inText && metaMatch) continue;
+      if (line.trim() || inText) {
         inText = true;
         textLines.push(line);
       }
     }
 
     const text = textLines.join('\n').trim();
-    const platform = (meta['platform'] ?? 'linkedin') as Platform;
-    const trainingWeight = parseFloat(meta['training_weight'] ?? '1.0');
-
-    if (text && text.length > 50) {
-      posts.push({
-        module: meta['module'],
-        platform,
-        training_weight: trainingWeight,
-        voice_notes: meta['voice_notes'],
-        text,
-      });
-    }
+    if (text && text.length > 50) posts.push({ text });
   }
 
-  return posts;
+  return posts.slice(0, 5);
 }
 
 async function main(): Promise<void> {
   const tenantId = process.env['TENANT_ID'] ?? 'local';
-  const storage: IVoiceStorage = process.env['SUPABASE_URL']
-    ? new SupabaseStorage(process.env['SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '', tenantId)
-    : new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);
 
   let content: string;
   try {
     content = readFileSync('voice-bootstrap.md', 'utf-8');
   } catch {
-    console.error('voice-bootstrap.md not found. Edit it with 3–5 posts in your voice, then run again.');
+    console.error('voice-bootstrap.md not found. Add 1-5 posts, then run again.');
+    process.exit(1);
+  }
+
+  const parsedPosts = parseBootstrapFile(content);
+  if (parsedPosts.length === 0) {
+    console.error('No valid bootstrap posts found. Add 1-5 posts separated by --- blocks.');
     process.exit(1);
   }
 
-  const posts = parseBootstrapFile(content);
-  console.log(`\nFound ${posts.length} posts to seed.\n`);
+  const bootstrapPosts: BootstrapPost[] = parsedPosts.map((post) => ({
+    text: post.text,
+    pasted_at: new Date().toISOString(),
+  }));
+
+  if (process.env['SUPABASE_URL']) {
+    const url = process.env['SUPABASE_URL'];
+    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
+    if (!url || !key || !tenantId || tenantId === 'local') {
+      console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and real TENANT_ID are required in Supabase mode.');
+      process.exit(1);
+    }
 
-  for (const post of posts) {
-    const draftId = await storage.saveDraft({
-      commit_sha: `bootstrap-${randomUUID()}`,
-      repo: 'bootstrap/manual',
-      platform: post.platform,
-      ai_draft: post.text,
+    const db = createClient(url, key);
+    const storage = new SupabaseStorage(url, key, tenantId);
+    const stored = await storage.getVoiceProfile(null);
+    const nextVoice: VoiceProfile = mergeVoiceProfile({
+      ...(stored?.voice ?? DEFAULT_VOICE_PROFILE),
+      bootstrap_posts: bootstrapPosts,
     });
+    const saved = await storage.saveVoiceProfile(null, nextVoice, stored?.version);
+    if (!saved) {
+      console.error('Failed to save bootstrap voice profile due to version conflict.');
+      process.exit(1);
+    }
 
-    // Immediately mark as published with edit_ratio = training_weight (1.0 = unchanged)
-    await storage.updatePublished({
-      id: draftId,
-      published: post.text,
-      edit_ratio: Math.min(1.0, post.training_weight),
-      published_at: new Date().toISOString(),
+    await db
+      .from('tenants')
+      .update({
+        voice_bootstrap: JSON.stringify(parsedPosts.map((post) => post.text)),
+      })
+      .eq('id', tenantId);
+  } else {
+    const storage = new SqliteStorage(process.env['SQLITE_PATH'] ?? 'data/devcast.db', tenantId);

--- scripts/validate-registry.ts
diff --git a/scripts/validate-registry.ts b/scripts/validate-registry.ts
new file mode 100644
index 0000000..80e53e8
--- /dev/null
+++ b/scripts/validate-registry.ts
@@ -0,0 +1,129 @@
+import { readFileSync, writeFileSync } from 'fs';
+import { MOVES_REGISTRY } from '../src/voice/moves-registry.js';
+
+interface ReferencePost {
+  writer_name: string;
+  url: string;
+  title: string;
+  text: string;
+  word_count: number;
+  fetched_at: string;
+}
+
+interface WriterProfile {
+  writer: string;
+  total_posts: number;
+  move_frequencies: Record<string, number>;
+  activated_moves: string[];
+  top_5_moves: string[];
+}
+
+function getArg(name: string): string | undefined {
+  const idx = process.argv.indexOf(name);
+  return idx >= 0 ? process.argv[idx + 1] : undefined;
+}
+
+function loadReferencePosts(path: string): ReferencePost[] {
+  return JSON.parse(readFileSync(path, 'utf8')) as ReferencePost[];
+}
+
+function buildWriterProfiles(referencePosts: ReferencePost[]): WriterProfile[] {
+  const writers = [...new Set(referencePosts.map((post) => post.writer_name))];
+
+  return writers.map((writer) => {
+    const posts = referencePosts.filter((post) => post.writer_name === writer);
+    const moveFrequencies: Record<string, number> = {};
+
+    for (const move of MOVES_REGISTRY) {
+      if (!move.regex) continue;
+      const matches = posts.filter((post) => move.regex!.test(post.text)).length;
+      moveFrequencies[move.id] = matches / Math.max(posts.length, 1);
+    }
+
+    const activatedMoves = Object.entries(moveFrequencies)
+      .filter(([, frequency]) => frequency > 0.05)
+      .map(([id]) => id);
+
+    const top5Moves = Object.entries(moveFrequencies)
+      .sort((left, right) => right[1] - left[1])
+      .slice(0, 5)
+      .map(([id]) => id);
+
+    return {
+      writer,
+      total_posts: posts.length,
+      move_frequencies: moveFrequencies,
+      activated_moves: activatedMoves,
+      top_5_moves: top5Moves,
+    };
+  });
+}
+
+function buildValidationReport(writerProfiles: WriterProfile[]): string {
+  const signatureCounts = new Map<string, number>();
+  const registryMoveIds = MOVES_REGISTRY.filter((move) => move.regex).map((move) => move.id);
+  const activationCountByMove = new Map<string, number>();
+
+  for (const moveId of registryMoveIds) activationCountByMove.set(moveId, 0);
+
+  for (const profile of writerProfiles) {
+    const signature = profile.top_5_moves.join('|');
+    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
+    for (const moveId of profile.activated_moves) {
+      activationCountByMove.set(moveId, (activationCountByMove.get(moveId) ?? 0) + 1);
+    }
+  }
+
+  const duplicateTop5 = [...signatureCounts.values()].some((count) => count > 1);
+  const deadMoves = [...activationCountByMove.entries()].filter(([, count]) => count === 0).map(([id]) => id);
+  const universalMoves = [...activationCountByMove.entries()]
+    .filter(([, count]) => count === writerProfiles.length)
+    .map(([id]) => id);
+  const avgActivatedMoves = writerProfiles.length === 0
+    ? 0
+    : writerProfiles.reduce((sum, profile) => sum + profile.activated_moves.length, 0) / writerProfiles.length;
+
+  const lines = [
+    '# Registry Validation Report',
+    '',
+    `Writers analyzed: ${writerProfiles.length}`,
+    '',
+    '## Criteria',
+    `- Discrimination: ${duplicateTop5 ? 'FAIL' : 'PASS'}`,
+    `- Coverage: ${deadMoves.length === 0 ? 'PASS' : `FAIL (${deadMoves.join(', ')})`}`,
+    `- No universals: ${universalMoves.length === 0 ? 'PASS' : `FAIL (${universalMoves.join(', ')})`}`,
+    `- Spread: ${avgActivatedMoves >= 10 && avgActivatedMoves <= 25 ? 'PASS' : `FAIL (${avgActivatedMoves.toFixed(2)})`}`,
+    '',
+    '## Writer Profiles',
+    ...writerProfiles.flatMap((profile) => [
+      `### ${profile.writer}`,
+      `- Posts: ${profile.total_posts}`,
+      `- Activated moves: ${profile.activated_moves.join(', ') || 'none'}`,
+      `- Top 5: ${profile.top_5_moves.join(', ') || 'none'}`,
+      '',
+    ]),
+  ];
+
+  return lines.join('\n');
+}
+
+async function main(): Promise<void> {
+  const inputPath = getArg('--input') ?? 'scripts/registry-validation/reference-posts.json';
+  const outputPath = getArg('--output');
+  const referencePosts = loadReferencePosts(inputPath);
+  const writerProfiles = buildWriterProfiles(referencePosts);
+  const report = buildValidationReport(writerProfiles);
+
+  if (outputPath) {
+    writeFileSync(outputPath, report, 'utf8');
+    console.log(`Wrote validation report to ${outputPath}`);
+    return;
+  }
+
+  console.log(report);
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});


--- src/ai/post-generator.ts
diff --git a/src/ai/post-generator.ts b/src/ai/post-generator.ts
index 49c2127..cbbafc3 100644
--- a/src/ai/post-generator.ts
+++ b/src/ai/post-generator.ts
@@ -1,11 +1,11 @@
 import { logger } from '../utils/logger.js';
-import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
-import { computeEditRatio } from '../voice/similarity.js';
+import { buildSystemPrompt, buildUserPrompt, type VoicePromptContext } from './prompt-builder.js';
 import type { IAIClient } from './types.js';
 import type { Finding } from '../analysis/types.js';
-import type { IVoiceStorage, SaveDraftInput, VoicePost } from '../voice/storage.js';
+import type { IVoiceStorage, SaveDraftInput, VoiceStage } from '../voice/storage.js';
 import type { EnrichedCommit } from '../github/commit-enricher.js';
-import type { Config } from '../config/schema.js';
+import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
+import { detectOpeningMove } from '../voice/exposure.js';
 
 export interface GeneratedPosts {
   linkedinPost: string;   // clean LinkedIn text for direct posting
@@ -14,6 +14,19 @@ export interface GeneratedPosts {
   draftId: string;
 }
 
+export interface GeneratePostsOptions {
+  voiceProfile: VoiceProfile;
+  voiceStage: VoiceStage;
+  exposurePool?: import('../voice/storage.js').VoicePost[];
+  bootstrapPosts?: BootstrapPost[];
+  recentModuleIds?: string[];
+  chapterContext?: string;
+  industryContext?: string;
+  draftMetadata?: Partial<SaveDraftInput>;
+  draftIndexToday?: number;
+  varietyConstraint?: string;
+}
+
 /**
  * ONE Claude call per commit.
  * Stores ai_draft in DB immediately before returning.
@@ -25,27 +38,36 @@ export async function generatePosts(
   findings: Finding[],
   storage: IVoiceStorage,
   config: Config,
-  recentModuleIds: string[] = [],
-  industryContext?: string,
-  draftMetadata: Partial<SaveDraftInput> = {},
+  options: GeneratePostsOptions,
 ): Promise<GeneratedPosts> {
   if (findings.length === 0) {
     throw new Error('generatePosts called with 0 findings — caller should skip this call');
   }
 
-  // Fetch voice examples (linkedin as primary training platform)
-  const poolSize = config.posting.voice_examples_count * 3;
-  const voicePool = await storage.getTopVoiceExamples('linkedin', poolSize);
-  const voiceExamples = selectVoiceExamples(voicePool, findings, config.posting.voice_examples_count);
+  const draftMetadata = options.draftMetadata ?? {};
+  const voiceContext: VoicePromptContext = {
+    stage: options.voiceStage,
+    exposurePool: options.exposurePool ?? [],
+    bootstrapPosts: options.bootstrapPosts ?? [],
+    commitSha: commit.sha,
+    draftIndexToday: options.draftIndexToday ?? 0,
+    varietyConstraint: options.varietyConstraint,
+  };
 
-  const systemPrompt = buildSystemPrompt(config);
-  const userPrompt = buildUserPrompt(commit, findings, voiceExamples, config, recentModuleIds, industryContext);
+  const systemPrompt = buildSystemPrompt(config, options.voiceProfile, voiceContext);
+  const userPrompt = buildUserPrompt(
+    commit,
+    findings,
+    options.recentModuleIds ?? [],
+    options.chapterContext,
+    options.industryContext,
+  );
 
   logger.info('ai.generate.start', {
     sha: commit.sha,
     repo: commit.repo,
     findings: findings.length,
-    has_industry_context: industryContext !== undefined,
+    has_industry_context: options.industryContext !== undefined,
   });
 
   const rawResponse = await client.complete(systemPrompt, userPrompt);
@@ -55,6 +77,7 @@ export async function generatePosts(
   const topFinding = findings[0]?.finding;
   const topModuleId = findings[0]?.moduleId;
   const findingsCount = findings.length;
+  const openingMove = detectOpeningMove(post);
 
   // One record per commit — ai_draft stores the full post for voice training
   const draftId = await storage.saveDraft({
@@ -65,6 +88,8 @@ export async function generatePosts(
     top_finding: topFinding,
     top_module_id: topModuleId,
     findings_count: findingsCount,
+    generation_system: draftMetadata.generation_system ?? (options.voiceStage === 'cold' ? 'v1' : 'v2_progressive'),
+    opening_move: draftMetadata.opening_move ?? openingMove,
     ...draftMetadata,
   });
 
@@ -90,58 +115,4 @@ function parseResponse(raw: string): { post: string; shortPost: string } {
     shortPost: (shortMatch[1] ?? '').trim(),
   };
 }
-
-/**
- * Selects voice examples using a two-pass strategy:
- *
- * Pass 1 — Anchors (style fidelity): pick the top 2 posts by edit_ratio.
- *   These ground Claude in the user's best-preserved voice patterns.
- *
- * Pass 2 — Topic match (relevance): from the remaining pool, rank by
- *   text similarity between post.top_finding and the current findings
- *   headlines. Fill remaining slots with the most topically similar posts.
- *
- * Final deduplication by published text prevents repeated examples.
- */
-function selectVoiceExamples(
-  posts: VoicePost[],
-  findings: Finding[],
-  limit: number,
-): VoicePost[] {
-  // Deduplicate pool by published text first
-  const seen = new Set<string>();
-  const pool: VoicePost[] = [];
-  for (const post of posts.sort((a, b) => (b.edit_ratio ?? 0) - (a.edit_ratio ?? 0))) {
-    const key = (post.published ?? post.ai_draft).slice(0, 100);
-    if (seen.has(key)) continue;
-    seen.add(key);
-    pool.push(post);
-  }
-
-  if (pool.length === 0) return [];
-
-  // Pass 1: anchors — top 2 by edit_ratio
-  const anchorCount = Math.min(2, Math.floor(limit / 2), pool.length);
-  const anchors = pool.slice(0, anchorCount);
-  const anchorIds = new Set(anchors.map((p) => p.id));
-
-  // Pass 2: topic match from the remaining candidates
-  const topicSlots = limit - anchors.length;
-  if (topicSlots <= 0) return anchors;
-
-  const topicQuery = findings.map((f) => f.finding).join(' ');
-  const candidates = pool.filter((p) => !anchorIds.has(p.id));
-

--- src/ai/prompt-builder.ts
diff --git a/src/ai/prompt-builder.ts b/src/ai/prompt-builder.ts
index d48ad93..fffa3c3 100644
--- a/src/ai/prompt-builder.ts
+++ b/src/ai/prompt-builder.ts
@@ -1,229 +1,498 @@
 import type { Finding } from '../analysis/types.js';
-import type { VoicePost } from '../voice/storage.js';
+import type { BootstrapPost, Config, VoiceProfile } from '../config/schema.js';
 import type { EnrichedCommit } from '../github/commit-enricher.js';
-import type { Config } from '../config/schema.js';
-
-/**
- * Assembles the prompt following Anthropic's long-context best practices:
- *
- * [SYSTEM — ~300 tokens]
- * [VOICE EXAMPLES — TOP of context, ordered edit_ratio DESC]
- * [COMMIT CONTEXT — middle]
- * [MODULE FINDINGS — below commit, above task]
- * [TASK INSTRUCTION — BOTTOM]
- */
-export function buildSystemPrompt(config: Config): string {
-  const { name, website } = config.author;
-  const websiteLine = website ? `Site: ${website} — "The Art of Improving Without Starting Over"\n` : '';
-
-  return `You are a ghostwriter. You write social media posts in ${name}'s voice.
-You receive findings from code analysis modules. Your job is to WRITE, not analyze.
-
-<author>
-${name} — Software Architect. 10+ years.
-${websiteLine}Financial systems, Kubernetes, AI/ML, cloud architecture.
-</author>
-
-<voice_devices>
-These are the specific writing devices that define ${name}'s voice.
-Use them. Vary which ones you use per post, but every post must use at least 3.
-
-STACCATO QUALIFIERS: Chain 2-3 single-word sentences after a statement.
-  "Clean. Disciplined. Strong."
-  "Beautiful. Humiliating. Exactly what you want, frankly."
-  "Cascading. Silent. Very bad. The worst kind."
-
-VERY CRESCENDO: "Very X. Very Y." as self-aware commentary. 2-3 per post max.
-  "Very fast. Very convenient. Also: a complete disaster in about three weeks."
-  "Very exciting. Very useful."
-  "Very glamorous? No. Very effective? Absolutely."
-
-SELF-AWARE Q&A: Ask and answer in two beats.
-  "Very glamorous? No. Very effective? Absolutely."
-  "The best part? The wrong path is no longer unlikely. It's impossible to compile."
-
-CONTRADICTORY PAIRS: Two adjectives that clash on purpose.
-  "Very disciplined. Very slow."
-  "Beautiful. Humiliating."
-
-ONE-WORD PUNCTURE: A single word as its own sentence to break rhythm.
-  "Wrong."
-  "Gone."
-  "Incredible."
-
-PARENTHETICAL REPETITION: Repeat a word for emphasis inside an aside.
-  "which changes constantly, by the way, constantly"
-
-FRANKLY DROP: "frankly" as a confidence marker mid-sentence.
-  "Exactly what you want, frankly."
-
-DIRECT CLOSING: End with a short declarative. Never a question.
-  "Use it."
-  "Rocks, you."
-  "Probably first."
-  "That's where the good stuff is."
-  "Architecture first. Then AI."
-</voice_devices>
-
-<structure>
-HOOK: One concrete fact — a decision, a surprise, a tradeoff. No preamble. No "Today I..." or "I'm excited to..."
-  "A type guard stopped a cascading client deactivation bug."
-  "I shipped a module that finds performance bugs in code. Very exciting. Very useful."
-  "The retries were working. The idempotency key wasn't. Classic."
-
-CONTEXT: 2-3 short sentences. Project name, what was happening. No long explanations.
-
-THE WORK: What changed and why. Use specific details from the findings.
-  Name files, name patterns, name numbers. Never vague.
-
-LESSON: One transferable principle. Named concept when applicable.
-  "Make the bad path impossible."
-  "The refactor window is real."
-
-CLOSING: Direct statement. See DIRECT CLOSING device above.
-</structure>
-
-<never>
-- Format headers like "**LINKEDIN**" or "## LinkedIn" in the output
-- Self-check reasoning or meta-commentary about the task
-- "Here's the context:" or "Let me explain:" setup paragraphs
-- "I'm building Devcast" in every post — only when the commit is about Devcast
-- Generic LinkedIn motivation ("excited to share", "humbled", "on a journey")
-- Engagement-bait questions ("thoughts?", "what do you think?")
-- Corporate buzzwords ("leverage", "synergy")
-- Emojis
-- Code blocks (they don't render on LinkedIn)
-- Lead with counts or quantities: not line counts, file counts, module counts, or commit sizes.
-  A reader should never think "okay, they changed 5 files." They should think "that's the decision I would have gotten wrong."
-  Lead with: the tradeoff that forced a decision, the consequence that surprised you, or the moment the architecture clicked.
-  Write like someone who learned something the hard way — not like someone filing a report.
-</never>
-
-<format>
-Post: 1200-1800 characters. Each sentence is its own paragraph.
-  Short paragraphs with aggressive line breaks ARE the format — do NOT compress.
-  3-5 hashtags at the end. Always include #lilicurl.
-
-Short version (Twitter): 3-5 staccato lines max. No hashtags. No preamble.
-  The single hook that makes someone stop. Nothing else.
-  Example: "A type guard stopped a cascading bug.\nNot a try/catch. A type guard.\nMake the bad path impossible."
-</format>`;
+import { rollVoiceDice } from '../voice/dice.js';
+import {
+  moduleIdToLabel,
+  selectExposureExamples,
+  syntheticVoicePost,
+  trimExposureExamples,
+} from '../voice/exposure.js';
+import type { VoicePost, VoiceStage } from '../voice/storage.js';
+import { resolvePromptTier } from '../voice/profile-utils.js';
+
+const TONE_INSTRUCTIONS: Record<VoiceProfile['tone'], string> = {
+  formal: 'Use precise, composed language with confident transitions.',
+  professional: 'Sound experienced, direct, and useful without corporate filler.',
+  casual: 'Write naturally and conversationally while keeping technical credibility.',
+  humorous: 'Allow light wit, but keep the technical point sharper than the joke.',
+  storytelling: 'Shape the post like a short narrative with a clear turn or lesson.',
+  teaching: 'Explain the why behind the change so another engineer can reuse the insight.',
+};
+
+const RHYTHM_INSTRUCTIONS: Record<VoiceProfile['rhythm'], string> = {
+  paragraphs: 'Prefer fuller paragraphs with deliberate transitions.',
+  mixed: 'Mix short punchy lines with a few fuller paragraphs.',
+  'short-sentences': 'Keep sentences compact and break aggressively for scanability.',
+};
+
+const STRUCTURE_MAP: Record<VoiceProfile['tone'] | 'professional_default', string> = {
+  formal: 'Open with the decisive technical fact, add context, explain the tradeoff, end on the principle.',
+  professional: 'Lead with the concrete decision or consequence, explain the work, land on the reusable lesson.',
+  casual: 'Start with the real moment of friction, explain what changed, close with the takeaway.',
+  humorous: 'Open with the sharpest contradiction or surprise, explain the fix, close with a dry lesson.',
+  storytelling: 'Start in the middle of the moment, explain the turn, end with what changed your mind.',
+  teaching: 'Open with the insight, walk through the implementation, close with the principle to reuse.',
+  professional_default: 'Lead with the decision or surprise, explain the implementation, end with the reusable principle.',
+};

--- src/buffer/sent-scanner.ts
diff --git a/src/buffer/sent-scanner.ts b/src/buffer/sent-scanner.ts
index c8ad9a5..24a7d5b 100644
--- a/src/buffer/sent-scanner.ts
+++ b/src/buffer/sent-scanner.ts
@@ -3,8 +3,12 @@ import { computeEditRatio } from '../voice/similarity.js';
 import type { BufferClient } from './client.js';
 import type { IVoiceStorage, Platform } from '../voice/storage.js';
 import type { Config } from '../config/schema.js';
+import { computeEditAnalysis, deriveContentPreferences } from '../voice/feedback.js';
+import { refreshVoiceMoves } from '../voice/moves-calculator.js';
+import { mergeVoiceProfile } from '../voice/profile-utils.js';
 
 const MATCH_THRESHOLD = 0.4;  // min similarity to count as a match
+const EXPIRED_DAYS = 7;
 
 function extractLinkedInUrn(externalLink: string | null): string | undefined {
   if (!externalLink) return undefined;
@@ -39,6 +43,12 @@ export async function scanSentPosts(
     logger.info('sent_scanner.start', { platform });
     await scanPlatform(bufferClient, storage, platform, orgId, profileId);
   }
+
+  const authors = await storage.listActiveAuthors(30);
+  for (const authorLogin of authors) {
+    await refreshContentPreferences(storage, authorLogin);
+    await refreshVoiceMoves(storage, authorLogin);
+  }
 }
 
 async function scanPlatform(
@@ -81,11 +91,13 @@ async function scanPlatform(
       const bestDraft = remaining[bestIdx]!;
       const publishedAt = sentPost.createdAt;
       const linkedinUrn = extractLinkedInUrn(sentPost.externalLink);
+      const editAnalysis = computeEditAnalysis(bestDraft, sentPost.text);
       await storage.updatePublished({
         id: bestDraft.id,
         published: sentPost.text,
         edit_ratio: bestScore,
         published_at: publishedAt,
+        edit_analysis: editAnalysis,
         linkedin_urn: linkedinUrn,
         publish_source: 'buffer',
       });
@@ -101,5 +113,45 @@ async function scanPlatform(
     }
   }
 
+  const staleDrafts = remaining.filter((draft) => (
+    !!draft.buffer_post_id
+    && !!draft.scheduled_at
+    && new Date(draft.scheduled_at).getTime() < Date.now() - EXPIRED_DAYS * 24 * 60 * 60 * 1000
+  ));
+  if (staleDrafts.length > 0) {
+    await storage.markExpired(staleDrafts.map((draft) => draft.id));
+    logger.info('sent_scanner.expired', { platform, count: staleDrafts.length });
+  }
+
   logger.info('sent_scanner.done', { platform, scanned: sentPosts.length, matched });
 }
+
+async function refreshContentPreferences(storage: IVoiceStorage, authorLogin: string): Promise<void> {
+  const outcomes = await storage.getRecentOutcomes(authorLogin, 20);
+  if (outcomes.length < 10) return;
+
+  const storedProfile = await storage.getVoiceProfile(authorLogin);
+  const voiceProfile = mergeVoiceProfile(storedProfile?.voice);
+  const updatedAt = voiceProfile.content_preferences?.updated_at;
+
+  if (updatedAt) {
+    const newOutcomes = outcomes.filter((post) => new Date(post.published_at ?? post.created_at) > new Date(updatedAt));
+    if (newOutcomes.length < 10) return;
+  }
+
+  const contentPreferences = deriveContentPreferences(outcomes);
+  const nextProfile = {
+    ...voiceProfile,
+    content_preferences: contentPreferences,
+  };
+
+  await storage.saveVoiceProfile(authorLogin, nextProfile, storedProfile?.version);
+
+  if ((contentPreferences.expired_rate_30d ?? 0) > 0.3) {
+    logger.warn('voice.content_preferences.expired_rate_high', {
+      tenantId: storage.tenantId,
+      authorLogin,
+      expiredRate30d: contentPreferences.expired_rate_30d,
+    });
+  }
+}


--- src/config/schema.ts
diff --git a/src/config/schema.ts b/src/config/schema.ts
index 1a777af..c8b40fe 100644
--- a/src/config/schema.ts
+++ b/src/config/schema.ts
@@ -1,10 +1,94 @@
 import { z } from 'zod';
+import { MODULE_REGISTRY } from '../analysis/modules/index.js';
+
+const MODULE_IDS = new Set(MODULE_REGISTRY.map((module) => module.id));
 
 const PlatformConfigSchema = z.object({
   enabled: z.boolean(),
   buffer_profile_id: z.string().default(''),
 });
 
+export const AudienceSchema = z.enum(['peers', 'hiring-managers', 'general-tech', 'mixed']);
+export const ToneSchema = z.enum(['formal', 'professional', 'casual', 'humorous', 'storytelling', 'teaching']);
+export const RhythmSchema = z.enum(['paragraphs', 'mixed', 'short-sentences']);
+export const HashtagModeSchema = z.enum(['always', 'prefer']);
+export const HookStyleSchema = z.enum([
+  'question',
+  'statistic',
+  'anecdote',
+  'declarative',
+  'contradiction',
+  'problem-first',
+]);
+
+export const ContentStrategySchema = z.object({
+  focus_modules: z.array(z.string()).optional().refine(
+    (modules) => !modules || modules.every((moduleId) => MODULE_IDS.has(moduleId)),
+    'focus_modules must reference valid analysis module ids',
+  ),
+  audience: AudienceSchema.default('mixed'),
+  skip_patterns: z.array(z.string()).default([]),
+});
+
+export const ContentPreferencesSchema = z.object({
+  preferred_modules: z.array(z.string()).optional(),
+  discouraged_hook_styles: z.array(HookStyleSchema).optional(),
+  typical_length_delta: z.number().optional(),
+  industry_context_preference: z.enum(['prefer', 'neutral', 'avoid']).optional(),
+  expired_rate_30d: z.number().min(0).max(1).optional(),
+  updated_at: z.string().optional(),
+});
+
+export const BootstrapPostSchema = z.object({
+  text: z.string().min(1),
+  pasted_at: z.string(),
+});
+
+const VoiceExamplesPoolSchema = z.object({
+  linkedin: z.array(z.string()).optional(),
+  instagram: z.array(z.string()).optional(),
+});
+
+export const VoiceProfileSchema = z.object({
+  tone: ToneSchema.default('professional'),
+  rhythm: RhythmSchema.default('mixed'),
+  hashtags: z.array(z.string()).max(10).default([]),
+  hashtags_mode: HashtagModeSchema.default('prefer'),
+  post_length: z.object({
+    min: z.number().int().min(300),
+    max: z.number().int().max(3000),
+  }).refine(({ min, max }) => min < max, 'post_length.min must be lower than post_length.max')
+    .default({ min: 1200, max: 1800 }),
+  content_strategy: ContentStrategySchema.default({
+    audience: 'mixed',
+    skip_patterns: [],
+  }),
+  style_patterns: z.string().max(400).optional(),
+  voice_devices: z.string().max(300).optional(),
+  voice_summary: z.string().max(200).optional(),
+  extraction_source: z.enum(['bootstrap', 'published_posts']).optional(),
+  extracted_at: z.string().optional(),
+  content_preferences: ContentPreferencesSchema.optional(),
+  voice_moves: z.record(z.string(), z.number().min(0).max(1)).optional(),
+  voice_stage: z.enum(['cold', 'bootstrap', 'warming', 'established']).optional(),
+  voice_examples_pool: VoiceExamplesPoolSchema.optional(),
+  always_hashtags: z.array(z.string()).max(10).optional(),
+  recent_opening_sequence: z.array(z.string()).max(5).optional(),
+  bootstrap_posts: z.array(BootstrapPostSchema).max(5).optional(),
+}).passthrough();
+
+export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
+  tone: 'professional',
+  rhythm: 'mixed',
+  hashtags: [],
+  hashtags_mode: 'prefer',
+  post_length: { min: 1200, max: 1800 },
+  content_strategy: {
+    audience: 'mixed',
+    skip_patterns: [],
+  },
+};
+
 export const ConfigSchema = z.object({
   author: z.object({
     github_username: z.string().min(1),
@@ -50,3 +134,12 @@ export const ConfigSchema = z.object({
 });
 
 export type Config = z.infer<typeof ConfigSchema>;
+export type Audience = z.infer<typeof AudienceSchema>;
+export type Tone = z.infer<typeof ToneSchema>;
+export type Rhythm = z.infer<typeof RhythmSchema>;
+export type HashtagMode = z.infer<typeof HashtagModeSchema>;
+export type HookStyle = z.infer<typeof HookStyleSchema>;
+export type ContentStrategy = z.infer<typeof ContentStrategySchema>;
+export type ContentPreferences = z.infer<typeof ContentPreferencesSchema>;
+export type BootstrapPost = z.infer<typeof BootstrapPostSchema>;
+export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;


--- src/content/matcher.ts
diff --git a/src/content/matcher.ts b/src/content/matcher.ts
index 37aaaff..d702cb4 100644
--- a/src/content/matcher.ts
+++ b/src/content/matcher.ts
@@ -47,6 +47,7 @@ async function stage1BiEncoder(
   finding: FindingInput,
   embedder: IEmbedder,
   db: SupabaseClient,
+  similarityThreshold: number,
 ): Promise<CandidateArticle[]> {
   const embedding = await embedder.embed(finding.plainLanguage);
   const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
@@ -54,7 +55,7 @@ async function stage1BiEncoder(
   // pgvector cosine similarity search via Supabase RPC
   const { data, error } = await db.rpc('match_article_chunks', {
     query_embedding: embedding,
-    similarity_threshold: SIMILARITY_THRESHOLD,
+    similarity_threshold: similarityThreshold,
     match_count: TOP_CANDIDATES * 3,  // fetch more, deduplicate by article below
     min_quality_score: QUALITY_GATE,
     week_of_cutoff: cutoff,
@@ -225,10 +226,12 @@ export async function matchFindingsToArticles(
   embedder: IEmbedder,
   aiClient: IAIClient,
   db: SupabaseClient,
+  options?: { similarityThreshold?: number },
 ): Promise<MatchedContext | null> {
+  const similarityThreshold = options?.similarityThreshold ?? SIMILARITY_THRESHOLD;
   for (const finding of findings) {
     try {
-      const candidates = await stage1BiEncoder(finding, embedder, db);
+      const candidates = await stage1BiEncoder(finding, embedder, db, similarityThreshold);
       if (candidates.length === 0) continue;
 
       const match = await stage2CrossEncoder(finding, candidates, aiClient);


--- src/main-poll.ts
diff --git a/src/main-poll.ts b/src/main-poll.ts
index 941d3e0..3782104 100644
--- a/src/main-poll.ts
+++ b/src/main-poll.ts
@@ -21,6 +21,9 @@ import { notifyNewDraft } from './review/notifier.js';
 import { SqliteStorage } from './voice/sqlite-storage.js';
 import { SupabaseStorage } from './voice/supabase-storage.js';
 import type { IVoiceStorage } from './voice/storage.js';
+import { mergeVoiceProfile } from './voice/profile-utils.js';
+import { buildChapterContext, buildVarietyConstraint } from './ai/prompt-builder.js';
+import { computeVoiceStage } from './voice/stage.js';
 
 async function main(): Promise<void> {
   const config = loadConfig();
@@ -117,15 +120,48 @@ async function main(): Promise<void> {
       }
 
       // Generate post (ONE Claude call — returns full post + Twitter short variant)
+      const storedVoiceProfile = await storage.getVoiceProfile(commit.authorLogin ?? null);
+      const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
+      const authorLogin = commit.authorLogin ?? null;
+      const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
+      const voiceStage = computeVoiceStage(uniquePublished, (voiceProfile.bootstrap_posts?.length ?? 0) > 0);
+      const startOfDay = new Date();
+      startOfDay.setUTCHours(0, 0, 0, 0);
+      const draftsToday = authorLogin ? await storage.countDraftsSince(authorLogin, startOfDay.toISOString()) : 0;
+      const exposurePool = authorLogin && voiceStage !== 'cold'
+        ? await storage.getPublishedForExposure(authorLogin, 'linkedin')
+        : [];
+      const topModuleId = findings[0]?.moduleId;
+      const topModuleFireCount = topModuleId
+        ? recentModuleIds.filter((moduleId) => moduleId === topModuleId).length
+        : 0;
+      const chapterContext = topModuleId && topModuleFireCount >= 1
+        ? buildChapterContext(topModuleId, await storage.getRecentTopFindings(authorLogin, topModuleId, 2), topModuleFireCount + 1)
+        : undefined;
+      const todayFirstOpening = undefined;
+      const varietyConstraint = voiceStage !== 'cold'
+        ? buildVarietyConstraint(voiceProfile.recent_opening_sequence ?? [], draftsToday, todayFirstOpening ?? undefined) ?? undefined
+        : undefined;
       const { bufferText, draftId } = await generatePosts(
         anthropic,
         commit,
         findings,
         storage,
         config,
-        recentModuleIds,
-        undefined,
-        { author_login: commit.authorLogin },
+        {
+          voiceProfile,
+          voiceStage,
+          exposurePool,
+          bootstrapPosts: voiceProfile.bootstrap_posts ?? [],
+          recentModuleIds,
+          chapterContext,
+          draftMetadata: {
+            author_login: authorLogin,
+            generation_system: voiceStage === 'cold' ? 'v1' : 'v2_progressive',
+          },
+          draftIndexToday: draftsToday,
+          varietyConstraint,
+        },
       );
 
       // Publish ONE Buffer Idea with both variants in the text


--- src/voice/dice.ts
diff --git a/src/voice/dice.ts b/src/voice/dice.ts
new file mode 100644
index 0000000..87e33dc
--- /dev/null
+++ b/src/voice/dice.ts
@@ -0,0 +1,38 @@
+import { MOVES_REGISTRY, type MoveDefinition } from './moves-registry.js';
+import { hash, seededRandom } from './utils.js';
+
+export interface RolledMoves {
+  available: MoveDefinition[];
+  unavailable: MoveDefinition[];
+}
+
+export function calibrateMoveProbability(matchCount: number, totalPosts: number): number {
+  if (totalPosts < 5) return 0;
+  const raw = matchCount / totalPosts;
+  if (raw < 0.05) return 0;
+  if (raw > 0.9) return 0.9;
+  return Math.round(raw * 20) / 20;
+}
+
+export function rollVoiceDice(
+  moves: Record<string, number>,
+  commitSha: string,
+  draftIndexToday: number,
+): RolledMoves {
+  const available: MoveDefinition[] = [];
+  const unavailable: MoveDefinition[] = [];
+
+  for (const [moveId, probability] of Object.entries(moves)) {
+    if (probability <= 0 || probability >= 1) continue;
+
+    const move = MOVES_REGISTRY.find((candidate) => candidate.id === moveId);
+    if (!move) continue;
+
+    const seed = hash(`${commitSha}:${draftIndexToday}:${moveId}`);
+    const roll = seededRandom(seed);
+    if (roll < probability) available.push(move);
+    else unavailable.push(move);
+  }
+
+  return { available, unavailable };
+}


--- src/voice/exposure.ts
diff --git a/src/voice/exposure.ts b/src/voice/exposure.ts
new file mode 100644
index 0000000..692af2b
--- /dev/null
+++ b/src/voice/exposure.ts
@@ -0,0 +1,104 @@
+import type { BootstrapPost } from '../config/schema.js';
+import type { VoicePost } from './storage.js';
+import { MOVES_REGISTRY, OPENING_MOVE_IDS, type OpeningMoveType } from './moves-registry.js';
+import { createRng, hash, weightedShuffle } from './utils.js';
+
+export interface ExposureCandidate {
+  id?: string;
+  published?: string | null;
+  text?: string;
+  edit_ratio?: number | null;
+  top_module_id?: string | null;
+}
+
+export const MAX_EXPOSURE_CHARS = 4000;
+
+export function exposureWeight(editRatio: number | null | undefined): number {
+  const value = editRatio ?? 0;
+  if (value < 0.3) return 0;
+  if (value <= 0.65) return 1.2;
+  if (value <= 0.9) return 1.0;
+  return 0.8;
+}
+
+export function selectExposureExamples(
+  pool: ExposureCandidate[],
+  commitSha: string,
+  draftIndexToday: number,
+  maxExamples = 3,
+): ExposureCandidate[] {
+  if (pool.length === 0) return [];
+  if (pool.length <= maxExamples) return pool;
+
+  const rng = createRng(hash(`${commitSha}:${draftIndexToday}`));
+  const shuffled = weightedShuffle(
+    pool.map((post) => ({
+      item: post,
+      weight: exposureWeight(post.edit_ratio),
+    })),
+    rng,
+  );
+
+  const selected: ExposureCandidate[] = [];
+  const modulesSeen = new Set<string>();
+  for (const post of shuffled) {
+    if (selected.length >= maxExamples) break;
+    if (post.top_module_id && modulesSeen.has(post.top_module_id)) {
+      if (modulesSeen.size < maxExamples) continue;
+    }
+    selected.push(post);
+    if (post.top_module_id) modulesSeen.add(post.top_module_id);
+  }
+
+  return selected;
+}
+
+export function syntheticVoicePost(bp: BootstrapPost): ExposureCandidate {
+  return {
+    published: bp.text,
+    text: bp.text,
+    edit_ratio: 1.0,
+    top_module_id: null,
+  };
+}
+
+export function moduleIdToLabel(moduleId: string): string {
+  return moduleId.replace(/_/g, ' ');
+}
+
+export function detectOpeningMove(text: string): OpeningMoveType {
+  const firstLine = (text ?? '').split('\n').find((line) => line.trim().length > 0) ?? '';
+
+  for (const moveId of OPENING_MOVE_IDS) {
+    const regex = MOVES_REGISTRY.find((move) => move.id === moveId)?.regex;
+    if (regex?.test(firstLine)) return moveId;
+  }
+
+  return 'unknown';
+}
+
+export function trimExposureExamples(
+  examples: Array<{ text: string; topic: string }>,
+  maxChars = MAX_EXPOSURE_CHARS,
+): Array<{ text: string; topic: string }> {
+  const next = [...examples];
+  let totalChars = next.reduce((sum, example) => sum + example.text.length, 0);
+
+  while (totalChars > maxChars && next.length > 1) {
+    const longestIdx = next.reduce(
+      (maxIdx, example, idx) => (example.text.length > next[maxIdx]!.text.length ? idx : maxIdx),
+      0,
+    );
+    next.splice(longestIdx, 1);
+    totalChars = next.reduce((sum, example) => sum + example.text.length, 0);
+  }
+
+  if (totalChars > maxChars && next.length === 1) {
+    next[0] = {
+      ...next[0]!,
+      text: `${next[0]!.text.slice(0, maxChars)}\n[truncated]`,
+    };
+  }
+
+  return next;
+}


--- src/voice/feedback.ts
diff --git a/src/voice/feedback.ts b/src/voice/feedback.ts
new file mode 100644
index 0000000..c876927
--- /dev/null
+++ b/src/voice/feedback.ts
@@ -0,0 +1,196 @@
+import type { ContentPreferences, HookStyle } from '../config/schema.js';
+import type { EditAnalysis, VoicePost } from './storage.js';
+import { computeEditRatio, sharedTokenCount, tokenize } from './similarity.js';
+
+const HASHTAG_REGEX = /(?<=^|\s)#[A-Za-z0-9_]+/g;
+const COUNT_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
+
+export function computeEditAnalysis(post: VoicePost, publishedText: string): EditAnalysis {
+  const aiDraft = post.ai_draft;
+  const hookDraft = extractHook(aiDraft);
+  const hookPublished = extractHook(publishedText);
+  const closingDraft = extractClosing(aiDraft);
+  const closingPublished = extractClosing(publishedText);
+
+  const hookChanged = hasEnoughTokens(hookDraft, hookPublished)
+    ? computeEditRatio(hookDraft, hookPublished) < 0.5
+    : false;
+  const closingChanged = hasEnoughTokens(closingDraft, closingPublished)
+    ? computeEditRatio(closingDraft, closingPublished) < 0.5
+    : false;
+
+  const suggestedHashtags = extractHashtags(aiDraft);
+  const publishedHashtags = new Set(extractHashtags(publishedText).map((tag) => tag.toLowerCase()));
+  const keptSuggestedHashtags = suggestedHashtags.filter((tag) => publishedHashtags.has(tag.toLowerCase())).length;
+
+  const contextTokens = tokenize(post.match_connection ?? '');
+  const industryContextRemoved = (
+    !post.has_industry_context
+    || !post.match_connection
+    || contextTokens.length < 6
+  )
+    ? false
+    : (sharedTokenCount(post.match_connection, publishedText) / Math.max(contextTokens.length, 1)) < 0.5;
+
+  const editRatio = computeEditRatio(aiDraft, publishedText);
+  return {
+    hook_changed: hookChanged,
+    closing_changed: closingChanged,
+    length_delta: publishedText.length - aiDraft.length,
+    hashtags_kept_ratio: keptSuggestedHashtags / Math.max(suggestedHashtags.length, 1),
+    industry_context_removed: industryContextRemoved,
+    edit_type: classifyEditType(editRatio),
+  };
+}
+
+export function classifyHookStyle(text: string): HookStyle {
+  const hook = extractHook(text).trim();
+  const lower = hook.toLowerCase();
+
+  if (hook.endsWith('?')) return 'question';
+  if (/^(\d+|[\d.,]+%)/.test(hook) || [...COUNT_WORDS].some((word) => lower.startsWith(`${word} `))) {
+    return 'statistic';
+  }
+  if (/^(i|we|when i|today i)\b/.test(lower)) return 'anecdote';
+  if (/\b(but|except|turns out|the irony)\b/.test(lower)) return 'contradiction';
+  if (/\b(bug|incident|timeout|error|outage|failed)\b/.test(lower)) return 'problem-first';
+  return 'declarative';
+}
+
+export function deriveContentPreferences(outcomes: VoicePost[], now = new Date()): ContentPreferences {
+  const published = outcomes.filter((post) => post.status === 'published');
+  const latestPublished = published.slice(0, 10);
+  const recentWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
+
+  const moduleStats = new Map<string, { published: number; expired: number }>();
+  for (const outcome of outcomes) {
+    if (!outcome.top_module_id) continue;
+    const current = moduleStats.get(outcome.top_module_id) ?? { published: 0, expired: 0 };
+    if (outcome.status === 'published') current.published += 1;
+    if (outcome.status === 'expired') current.expired += 1;
+    moduleStats.set(outcome.top_module_id, current);
+  }
+
+  const preferredModules = [...moduleStats.entries()]
+    .map(([moduleId, stats]) => ({
+      moduleId,
+      publishRate: stats.published / Math.max(stats.published + stats.expired, 1),
+      published: stats.published,
+    }))
+    .filter((entry) => entry.published > 0)
+    .sort((left, right) => right.publishRate - left.publishRate || right.published - left.published)
+    .slice(0, 3)
+    .map((entry) => entry.moduleId);
+
+  const hookStats = new Map<HookStyle, { total: number; changed: number }>();
+  for (const post of latestPublished) {
+    if (!post.edit_analysis) continue;
+    const hookStyle = classifyHookStyle(post.ai_draft);
+    const current = hookStats.get(hookStyle) ?? { total: 0, changed: 0 };
+    current.total += 1;
+    if ((post.edit_analysis['hook_changed'] as boolean | undefined) === true) current.changed += 1;
+    hookStats.set(hookStyle, current);
+  }
+
+  const discouragedHookStyles = [...hookStats.entries()]
+    .filter(([, stats]) => stats.total >= 3 && stats.changed / stats.total >= 0.7)
+    .map(([style]) => style);
+
+  const lengthDeltas = latestPublished
+    .map((post) => post.edit_analysis?.['length_delta'])
+    .filter((value): value is number => typeof value === 'number');
+  const typicalLengthDelta = lengthDeltas.length > 0
+    ? Math.round(lengthDeltas.reduce((sum, value) => sum + value, 0) / lengthDeltas.length)
+    : undefined;
+
+  const recentOutcomes = outcomes.filter((post) => {
+    const timestamp = post.published_at ?? post.created_at;
+    return new Date(timestamp) >= recentWindowStart;
+  });
+  const expiredRate30d = recentOutcomes.length > 0
+    ? recentOutcomes.filter((post) => post.status === 'expired').length / recentOutcomes.length
+    : 0;
+
+  const attemptedContextPosts = published
+    .filter((post) => post.context_status === 'matched' || post.context_status === 'no_match')
+    .slice(0, 5);
+  const matchedContextPosts = attemptedContextPosts.filter((post) => post.context_status === 'matched');
+  const removedCount = matchedContextPosts.filter(
+    (post) => post.edit_analysis?.['industry_context_removed'] === true,
+  ).length;
+  const matchedAverageEditRatio = matchedContextPosts.length > 0
+    ? matchedContextPosts.reduce((sum, post) => sum + (post.edit_ratio ?? 0), 0) / matchedContextPosts.length
+    : 0;
+  const attemptedAverageEditRatio = attemptedContextPosts.length > 0
+    ? attemptedContextPosts.reduce((sum, post) => sum + (post.edit_ratio ?? 0), 0) / attemptedContextPosts.length
+    : 0;
+
+  let industryContextPreference: ContentPreferences['industry_context_preference'] = 'neutral';
+  if (matchedContextPosts.length === 5 && removedCount >= 3) {
+    industryContextPreference = 'avoid';
+  } else if (
+    matchedContextPosts.length === 5
+    && removedCount === 0
+    && matchedAverageEditRatio >= 0.8
+  ) {
+    industryContextPreference = 'prefer';
+  } else if (
+    attemptedContextPosts.length === 5
+    && removedCount === 0
+    && attemptedAverageEditRatio >= 0.8
+  ) {
+    industryContextPreference = 'neutral';
+  }
+

--- src/voice/moves-calculator.ts
diff --git a/src/voice/moves-calculator.ts b/src/voice/moves-calculator.ts
new file mode 100644
index 0000000..513be2c
--- /dev/null
+++ b/src/voice/moves-calculator.ts
@@ -0,0 +1,201 @@
+import { logger } from '../utils/logger.js';
+import type { VoiceProfile } from '../config/schema.js';
+import { DEFAULT_VOICE_PROFILE } from '../config/schema.js';
+import { calibrateMoveProbability } from './dice.js';
+import { MOVES_REGISTRY } from './moves-registry.js';
+import { computeVoiceStage } from './stage.js';
+import type { IVoiceStorage, VoicePost } from './storage.js';
+
+const HASHTAG_REGEX = /(?<=^|\s)#[A-Za-z0-9_]+/g;
+const FIRST_PERSON_OPENING = /^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed)/im;
+
+export async function refreshVoiceMoves(
+  storage: IVoiceStorage,
+  authorLogin: string,
+): Promise<void> {
+  let stored = await storage.getVoiceProfile(authorLogin);
+  const seedVoice = stored?.voice ?? DEFAULT_VOICE_PROFILE;
+
+  await storage.saveVoiceProfile(authorLogin, seedVoice, 0);
+  stored = await storage.getVoiceProfile(authorLogin);
+
+  const currentVoice = stored?.voice ?? DEFAULT_VOICE_PROFILE;
+  const currentVersion = stored?.version ?? 0;
+  const posts = await storage.getPublishedForMoves(authorLogin);
+  const totalUniquePublished = await storage.countUniquePublished(authorLogin);
+  const stage = computeVoiceStage(totalUniquePublished, !!currentVoice.bootstrap_posts?.length);
+
+  const [linkedinPool, instagramPool, recentOutcomes] = await Promise.all([
+    storage.getPublishedForExposure(authorLogin, 'linkedin'),
+    storage.getPublishedForExposure(authorLogin, 'instagram'),
+    storage.getRecentOutcomes(authorLogin, 20),
+  ]);
+
+  const voiceExamplesPool = {
+    ...(linkedinPool.length > 0 && { linkedin: linkedinPool.map((post) => post.id) }),
+    ...(instagramPool.length > 0 && { instagram: instagramPool.map((post) => post.id) }),
+  };
+
+  const alwaysHashtags = detectAlwaysHashtags(posts);
+  const recentOpeningSequence = recentOutcomes
+    .filter((post) => post.status === 'published' && post.opening_move && post.opening_move !== 'unknown')
+    .slice(0, 5)
+    .map((post) => post.opening_move as string)
+    .reverse();
+
+  if (posts.length < 5) {
+    const updatedVoice: VoiceProfile = {
+      ...currentVoice,
+      voice_stage: stage,
+      voice_examples_pool: voiceExamplesPool,
+      always_hashtags: alwaysHashtags,
+      recent_opening_sequence: recentOpeningSequence,
+      voice_summary: posts.length >= 3
+        ? computeProtoSummary(posts, alwaysHashtags)
+        : currentVoice.voice_summary ?? '',
+    };
+
+    const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
+    if (!saved) {
+      logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
+      return;
+    }
+
+    logger.info('voice.moves.refresh_skipped', {
+      tenantId: storage.tenantId,
+      authorLogin,
+      reason: 'insufficient_quality_posts_for_moves',
+      quality_filtered_count: posts.length,
+      total_unique_published: totalUniquePublished,
+      stage,
+    });
+    return;
+  }
+
+  if (stage === 'warming') {
+    const updatedVoice: VoiceProfile = {
+      ...currentVoice,
+      voice_stage: stage,
+      voice_examples_pool: voiceExamplesPool,
+      always_hashtags: alwaysHashtags,
+      recent_opening_sequence: recentOpeningSequence,
+      voice_summary: computeProtoSummary(posts, alwaysHashtags),
+    };
+
+    const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
+    if (!saved) {
+      logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
+      return;
+    }
+
+    logger.info('voice.moves.refreshed', {
+      tenantId: storage.tenantId,
+      authorLogin,
+      stage,
+      moves_count: 0,
+      always_hashtags: alwaysHashtags,
+      pool_size: linkedinPool.length + instagramPool.length,
+      posts_analyzed: posts.length,
+    });
+    return;
+  }
+
+  const newMoves: Record<string, number> = {};
+  for (const move of MOVES_REGISTRY) {
+    if (!move.regex) continue;
+    let matchCount = 0;
+    for (const post of posts) {
+      if (move.regex.test(post.published ?? '')) matchCount++;
+    }
+    const probability = calibrateMoveProbability(matchCount, posts.length);
+    if (probability > 0) newMoves[move.id] = probability;
+  }
+
+  const smoothed: Record<string, number> = {};
+  if (currentVoice.voice_moves) {
+    for (const [moveId, newProb] of Object.entries(newMoves)) {
+      const oldProb = currentVoice.voice_moves[moveId] ?? newProb;
+      smoothed[moveId] = Math.round((0.6 * oldProb + 0.4 * newProb) * 20) / 20;
+    }
+  } else {
+    Object.assign(smoothed, newMoves);
+  }
+
+  const updatedVoice: VoiceProfile = {
+    ...currentVoice,
+    voice_moves: smoothed,
+    voice_stage: stage,
+    voice_examples_pool: voiceExamplesPool,
+    always_hashtags: alwaysHashtags,
+    recent_opening_sequence: recentOpeningSequence,
+    voice_summary: computeVoiceSummary(smoothed),
+  };
+
+  const saved = await storage.saveVoiceProfile(authorLogin, updatedVoice, currentVersion);
+  if (!saved) {
+    logger.warn('voice.moves.refresh_conflict', { tenantId: storage.tenantId, authorLogin, stage });
+    return;
+  }
+
+  logger.info('voice.moves.refreshed', {
+    tenantId: storage.tenantId,
+    authorLogin,
+    stage,
+    moves_count: Object.keys(smoothed).length,

--- src/voice/moves-registry.ts
diff --git a/src/voice/moves-registry.ts b/src/voice/moves-registry.ts
new file mode 100644
index 0000000..b161b38
--- /dev/null
+++ b/src/voice/moves-registry.ts
@@ -0,0 +1,336 @@
+export type MoveCategory =
+  | 'rhythm'
+  | 'lexical'
+  | 'opening'
+  | 'structural'
+  | 'emphasis'
+  | 'closing'
+  | 'rhetorical'
+  | 'meta';
+
+export interface MoveDefinition {
+  id: string;
+  regex?: RegExp;
+  category: MoveCategory;
+  description: string;
+  example?: string;
+  negative_example?: string;
+}
+
+export const MOVES_REGISTRY: MoveDefinition[] = [
+  {
+    id: 'very_single',
+    regex: /\bvery\s+\w+[.!]/i,
+    category: 'rhythm',
+    description: "'Very X.' as standalone ironic intensifier",
+    example: 'Very slow. Very necessary.',
+    negative_example: "It was very interesting to see",
+  },
+  {
+    id: 'very_paired',
+    regex: /\bvery\s+\w+[.\s,]+very\s+\w+/i,
+    category: 'rhythm',
+    description: "'Very X. Very Y.' paired adjective rhythm for contrast",
+    example: 'Very clean. Very new.',
+  },
+  {
+    id: 'triple_cadence',
+    regex: /(?:^|\.\s+)([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)\s+([A-Z][^.]{3,30}\.)/m,
+    category: 'rhythm',
+    description: 'Three short declarative sentences in a row (X. Y. Z.)',
+    example: 'It compiled. It deployed. It broke.',
+  },
+  {
+    id: 'em_dash_rhythm',
+    regex: /—/,
+    category: 'rhythm',
+    description: 'Em-dash for parenthetical or dramatic pause',
+    example: 'The fix was obvious — in retrospect.',
+  },
+  {
+    id: 'semicolon_join',
+    regex: /;\s+[a-z]/,
+    category: 'rhythm',
+    description: 'Semicolon joining two independent clauses',
+    example: "The test passed; the deploy didn't.",
+  },
+  {
+    id: 'parenthetical_aside',
+    regex: /\([^)]{10,80}\)/,
+    category: 'rhythm',
+    description: 'Parenthetical aside or self-correction',
+    example: 'I shipped the fix (or what I thought was the fix).',
+  },
+  {
+    id: 'ellipsis_pause',
+    regex: /\.\.\./,
+    category: 'rhythm',
+    description: 'Ellipsis for trailing thought or dramatic pause',
+    example: 'I checked the logs and...',
+  },
+  {
+    id: 'frankly_adverb',
+    regex: /\bfrankly\b/i,
+    category: 'lexical',
+    description: "'Frankly' as self-aware conversational adverb",
+    example: 'Frankly, I expected it to break.',
+  },
+  {
+    id: 'exactly_emphasis',
+    regex: /\bexactly\b/i,
+    category: 'lexical',
+    description: "'Exactly' to pin down a precise point",
+    example: 'That is exactly the problem.',
+  },
+  {
+    id: 'beautiful_intensifier',
+    regex: /\bbeautiful\b/i,
+    category: 'lexical',
+    description: "'Beautiful' as intensifier for technical elegance",
+    example: 'A beautiful abstraction.',
+  },
+  {
+    id: 'incredible_reaction',
+    regex: /\bincredible\b/i,
+    category: 'lexical',
+    description: "'Incredible' as genuine reaction word",
+    example: 'The performance improvement was incredible.',
+  },
+  {
+    id: 'literally_emphasis',
+    regex: /\bliterally\b/i,
+    category: 'lexical',
+    description: "'Literally' for emphasis (often hyperbolic)",
+    example: 'It literally took 3 days.',
+  },
+  {
+    id: 'spoiler_tag',
+    regex: /\bspoiler\b/i,
+    category: 'lexical',
+    description: "'Spoiler:' as casual foreshadowing device",
+    example: "Spoiler: it didn't work.",
+  },
+  {
+    id: 'self_deprecating_word',
+    regex: /\b(wrong|mistake|broke|failed|embarrassing|humiliating|stupid)\b/i,
+    category: 'lexical',
+    description: 'Self-deprecating vocabulary (owning failure)',
+    example: 'I was completely wrong about the architecture.',
+  },
+  {
+    id: 'trump_cadence',
+    regex: /\b(tremendous|believe me|many people|nobody|everybody knows)\b/i,
+    category: 'lexical',
+    description: 'Hyperbolic intensifiers in the Trump style (ironic or playful)',
+    example: 'Tremendous improvement. Believe me.',
+  },
+  {
+    id: 'sound_like_me',
+    regex: /\bsound(s)?\s+like\s+me\b/i,
+    category: 'lexical',
+    description: "'Sound(s) like me' as meta-voice reference",
+    example: "That doesn't sound like me at all.",
+  },
+  {
+    id: 'opens_with_number',
+    regex: /^[\d,]+\s+(lines?|files?|commits?|decisions?|hours?|days?|minutes?)/im,
+    category: 'opening',
+    description: 'Opens with a numeric count (lines added, hours spent)',
+    example: '313 lines added. Zero removed.',
+    negative_example: 'I spent 3 hours debugging',
+  },
+  {
+    id: 'opens_first_person_action',
+    regex: /^I\s+(shipped|deleted|added|wrote|built|pushed|created|fixed|removed|broke|deployed|refactored)/im,

--- src/voice/profile-utils.ts
diff --git a/src/voice/profile-utils.ts b/src/voice/profile-utils.ts
new file mode 100644
index 0000000..da9aae2
--- /dev/null
+++ b/src/voice/profile-utils.ts
@@ -0,0 +1,72 @@
+import type { Finding } from '../analysis/types.js';
+import { DEFAULT_VOICE_PROFILE, type VoiceProfile } from '../config/schema.js';
+import type { EnrichedCommit } from '../github/commit-enricher.js';
+
+export function mergeVoiceProfile(profile: VoiceProfile | null | undefined): VoiceProfile {
+  if (!profile) return DEFAULT_VOICE_PROFILE;
+  return {
+    ...DEFAULT_VOICE_PROFILE,
+    ...profile,
+    content_strategy: {
+      ...DEFAULT_VOICE_PROFILE.content_strategy,
+      ...profile.content_strategy,
+    },
+    post_length: {
+      ...DEFAULT_VOICE_PROFILE.post_length,
+      ...profile.post_length,
+    },
+  };
+}
+
+export function resolvePromptTier(voiceProfile: VoiceProfile): 1 | 2 | 3 {
+  if (voiceProfile.style_patterns || voiceProfile.voice_devices) return 1;
+  return hasManualVoiceSignal(voiceProfile) ? 2 : 3;
+}
+
+function hasManualVoiceSignal(voiceProfile: VoiceProfile): boolean {
+  return (
+    voiceProfile.tone !== DEFAULT_VOICE_PROFILE.tone
+    || voiceProfile.rhythm !== DEFAULT_VOICE_PROFILE.rhythm
+    || voiceProfile.hashtags.length > 0
+    || voiceProfile.hashtags_mode !== DEFAULT_VOICE_PROFILE.hashtags_mode
+    || voiceProfile.post_length.min !== DEFAULT_VOICE_PROFILE.post_length.min
+    || voiceProfile.post_length.max !== DEFAULT_VOICE_PROFILE.post_length.max
+    || (voiceProfile.content_strategy.focus_modules?.length ?? 0) > 0
+    || voiceProfile.content_strategy.audience !== DEFAULT_VOICE_PROFILE.content_strategy.audience
+    || voiceProfile.content_strategy.skip_patterns.length > 0
+  );
+}
+
+export function filterFindingsByContentStrategy(
+  findings: Finding[],
+  voiceProfile: VoiceProfile,
+): Finding[] {
+  const focus = voiceProfile.content_strategy.focus_modules;
+  if (!focus || focus.length === 0) return findings;
+  const focusSet = new Set(focus);
+  return findings.filter((finding) => focusSet.has(finding.moduleId));
+}
+
+export function matchesSkipPatterns(
+  commit: EnrichedCommit,
+  findings: Finding[],
+  voiceProfile: VoiceProfile,
+): string | null {
+  const skipPatterns = voiceProfile.content_strategy.skip_patterns
+    .map((pattern) => pattern.trim().toLowerCase())
+    .filter(Boolean);
+  if (skipPatterns.length === 0) return null;
+
+  const haystack = [
+    commit.repo,
+    commit.message,
+    ...findings.flatMap((finding) => [
+      finding.finding,
+      finding.plainLanguage,
+      finding.contextHint ?? '',
+      finding.technicalDetail,
+    ]),
+  ].join('\n').toLowerCase();
+
+  return skipPatterns.find((pattern) => haystack.includes(pattern)) ?? null;
+}


--- src/voice/similarity.ts
diff --git a/src/voice/similarity.ts b/src/voice/similarity.ts
index 0f8eab9..2334119 100644
--- a/src/voice/similarity.ts
+++ b/src/voice/similarity.ts
@@ -6,8 +6,8 @@
  * Simple, fast, and language-agnostic.
  */
 export function computeEditRatio(draft: string, published: string): number {
-  const draftWords = tokenize(draft);
-  const publishedWords = tokenize(published);
+  const draftWords = tokenize(textOrEmpty(draft));
+  const publishedWords = tokenize(textOrEmpty(published));
 
   if (draftWords.length === 0 && publishedWords.length === 0) return 1.0;
   if (draftWords.length === 0 || publishedWords.length === 0) return 0.0;
@@ -32,10 +32,36 @@ export function computeEditRatio(draft: string, published: string): number {
   return shared / maxWords;
 }
 
-function tokenize(text: string): string[] {
+export function tokenize(text: string): string[] {
   return text
     .toLowerCase()
     .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
     .split(/\s+/)
     .filter(w => w.length > 0);
 }
+
+export function sharedTokenCount(left: string, right: string): number {
+  const leftWords = tokenize(textOrEmpty(left));
+  const rightWords = tokenize(textOrEmpty(right));
+  const leftMap = new Map<string, number>();
+
+  for (const word of leftWords) {
+    leftMap.set(word, (leftMap.get(word) ?? 0) + 1);
+  }
+
+  let shared = 0;
+  const rightMap = new Map<string, number>();
+  for (const word of rightWords) {
+    rightMap.set(word, (rightMap.get(word) ?? 0) + 1);
+  }
+
+  for (const [word, count] of rightMap) {
+    shared += Math.min(count, leftMap.get(word) ?? 0);
+  }
+
+  return shared;
+}
+
+function textOrEmpty(value: string): string {
+  return value ?? '';
+}


--- src/voice/sqlite-storage.ts
diff --git a/src/voice/sqlite-storage.ts b/src/voice/sqlite-storage.ts
index 4670180..43fec1f 100644
--- a/src/voice/sqlite-storage.ts
+++ b/src/voice/sqlite-storage.ts
@@ -2,6 +2,7 @@ import Database from 'better-sqlite3';
 import { randomUUID } from 'crypto';
 import { mkdirSync } from 'fs';
 import { dirname } from 'path';
+import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../config/schema.js';
 import type {
   IVoiceStorage,
   VoicePost,
@@ -11,9 +12,57 @@ import type {
   UpdateEngagementInput,
   Platform,
   PostStatus,
+  RecentTopFinding,
   SlottedPost,
+  StoredVoiceProfile,
 } from './storage.js';
 
+interface SqliteVoiceProfileRow {
+  id: string;
+  github_author_login: string | null;
+  voice: string;
+  version: number;
+}
+
+type SqliteVoicePostRow = Omit<VoicePost, 'edit_analysis' | 'has_industry_context'> & {
+  edit_analysis: string | null;
+  has_industry_context: number;
+};
+
+function normalizeVoiceProfile(candidate: unknown): VoiceProfile | null {
+  const parsed = VoiceProfileSchema.safeParse(candidate);
+  if (!parsed.success) return null;
+  return {
+    ...DEFAULT_VOICE_PROFILE,
+    ...parsed.data,
+    content_strategy: {
+      ...DEFAULT_VOICE_PROFILE.content_strategy,
+      ...parsed.data.content_strategy,
+    },
+    post_length: {
+      ...DEFAULT_VOICE_PROFILE.post_length,
+      ...parsed.data.post_length,
+    },
+  };
+}
+
+function mapVoicePost(row: SqliteVoicePostRow): VoicePost {
+  let editAnalysis: Record<string, unknown> | null = null;
+  if (row.edit_analysis) {
+    try {
+      editAnalysis = JSON.parse(row.edit_analysis) as Record<string, unknown>;
+    } catch {
+      editAnalysis = null;
+    }
+  }
+
+  return {
+    ...row,
+    edit_analysis: editAnalysis,
+    has_industry_context: !!row.has_industry_context,
+  };
+}
+
 export class SqliteStorage implements IVoiceStorage {
   private readonly db: Database.Database;
   readonly tenantId: string;
@@ -57,6 +106,8 @@ export class SqliteStorage implements IVoiceStorage {
         reactions_count INTEGER NOT NULL DEFAULT 0,
         engagement_score REAL,
         publish_source  TEXT,
+        generation_system TEXT,
+        opening_move    TEXT,
         tenant_id       TEXT
       );
 
@@ -74,11 +125,31 @@ export class SqliteStorage implements IVoiceStorage {
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS match_connection     TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS last_reactions_fetch_at TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS publish_source   TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS generation_system TEXT;
+      ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS opening_move     TEXT;
       ALTER TABLE voice_posts ADD COLUMN IF NOT EXISTS tenant_id        TEXT;
 
       CREATE UNIQUE INDEX IF NOT EXISTS idx_sha_platform
         ON voice_posts(commit_sha, platform);
 
+      CREATE TABLE IF NOT EXISTS voice_profiles (
+        id                 TEXT PRIMARY KEY,
+        tenant_id          TEXT NOT NULL,
+        github_author_login TEXT,
+        voice              TEXT NOT NULL DEFAULT '{}',
+        version            INTEGER NOT NULL DEFAULT 1,
+        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
+        updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
+      );
+
+      CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_default
+        ON voice_profiles(tenant_id)
+        WHERE github_author_login IS NULL;
+
+      CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_profiles_tenant_author
+        ON voice_profiles(tenant_id, github_author_login)
+        WHERE github_author_login IS NOT NULL;
+
       CREATE TABLE IF NOT EXISTS scheduled_slots (
         id            TEXT PRIMARY KEY,
         platform      TEXT NOT NULL,
@@ -110,9 +181,9 @@ export class SqliteStorage implements IVoiceStorage {
       INSERT INTO voice_posts (
         id, commit_sha, repo, platform, ai_draft, top_finding, top_module_id, findings_count,
         author_login, context_status, has_industry_context, matched_article_id, matched_source_id,
-        match_strength, match_connection, status, tenant_id
+        match_strength, match_connection, generation_system, opening_move, status, tenant_id
       )
-      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
+      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
     `).run(
       id,
       input.commit_sha,
@@ -129,11 +200,71 @@ export class SqliteStorage implements IVoiceStorage {
       input.matched_source_id ?? null,
       input.match_strength ?? null,
       input.match_connection ?? null,
+      input.generation_system ?? null,
+      input.opening_move ?? null,
       this.tenantId,
     );
     return Promise.resolve(id);
   }
 
+  getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null> {
+    const exact = this.fetchVoiceProfileRow(authorLogin);
+    if (exact) {
+      return Promise.resolve({
+        voice: normalizeVoiceProfile(JSON.parse(exact.voice)) ?? DEFAULT_VOICE_PROFILE,
+        version: exact.version,
+      });
+    }
+
+    if (authorLogin) {
+      const fallback = this.fetchVoiceProfileRow(null);
+      if (fallback) {
+        return Promise.resolve({
+          voice: normalizeVoiceProfile(JSON.parse(fallback.voice)) ?? DEFAULT_VOICE_PROFILE,
+          version: fallback.version,
+        });

--- src/voice/stage.ts
diff --git a/src/voice/stage.ts b/src/voice/stage.ts
new file mode 100644
index 0000000..7882bbd
--- /dev/null
+++ b/src/voice/stage.ts
@@ -0,0 +1,8 @@
+import type { VoiceStage } from './storage.js';
+
+export function computeVoiceStage(uniquePublishedCount: number, hasBootstrap: boolean): VoiceStage {
+  if (uniquePublishedCount >= 15) return 'established';
+  if (uniquePublishedCount >= 5) return 'warming';
+  if (hasBootstrap) return 'bootstrap';
+  return 'cold';
+}


--- src/voice/storage.ts
diff --git a/src/voice/storage.ts b/src/voice/storage.ts
index a5cf513..2c23076 100644
--- a/src/voice/storage.ts
+++ b/src/voice/storage.ts
@@ -1,7 +1,24 @@
+import type { BootstrapPost, ContentStrategy, HookStyle, VoiceProfile } from '../config/schema.js';
+
 export type Platform = 'linkedin' | 'instagram';
-export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued';
+export type PostStatus = 'pending' | 'scheduled' | 'published' | 'queued' | 'expired' | 'failed';
 export type ContextStatus = 'skipped' | 'no_match' | 'matched';
 export type PublishSource = 'buffer' | 'linkedin_direct';
+export type VoiceStage = 'cold' | 'bootstrap' | 'warming' | 'established';
+
+export interface StoredVoiceProfile {
+  voice: VoiceProfile;
+  version: number;
+}
+
+export interface EditAnalysis {
+  hook_changed: boolean;
+  closing_changed: boolean;
+  length_delta: number;
+  hashtags_kept_ratio: number;
+  industry_context_removed: boolean;
+  edit_type: 'polish' | 'restructure' | 'rewrite';
+}
 
 export interface VoicePost {
   id: string;
@@ -32,6 +49,8 @@ export interface VoicePost {
   last_reactions_fetch_at: string | null;
   engagement_score: number | null;
   publish_source: PublishSource | null;
+  generation_system?: 'v1' | 'v2_progressive' | null;
+  opening_move?: string | null;
 }
 
 export interface SaveDraftInput {
@@ -49,6 +68,8 @@ export interface SaveDraftInput {
   matched_source_id?: string | null;
   match_strength?: number | null;
   match_connection?: string | null;
+  generation_system?: 'v1' | 'v2_progressive' | null;
+  opening_move?: string | null;
 }
 
 export interface UpdatePublishedInput {
@@ -56,6 +77,7 @@ export interface UpdatePublishedInput {
   published: string;
   edit_ratio: number;
   published_at: string;
+  edit_analysis?: EditAnalysis | null;
   linkedin_urn?: string;  // extracted from Buffer externalLink when available
   publish_source?: PublishSource;
 }
@@ -80,6 +102,11 @@ export interface SlottedPost {
   voice_post_id: string;
 }
 
+export interface RecentTopFinding {
+  top_finding: string;
+  published_at: string;
+}
+
 export interface IVoiceStorage {
   /** The tenant this storage instance is scoped to. All queries filter by this. */
   readonly tenantId: string;
@@ -87,6 +114,12 @@ export interface IVoiceStorage {
   /** Save an AI draft immediately after generation. Returns the new row ID. */
   saveDraft(input: SaveDraftInput): Promise<string>;
 
+  /** Lookup voice profile for a specific author, falling back to tenant default row only. */
+  getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null>;
+
+  /** Insert or update a voice profile row scoped to a specific author or tenant default. */
+  saveVoiceProfile(authorLogin: string | null, voice: VoiceProfile, expectedVersion?: number): Promise<boolean>;
+
   /** Update a post after Buffer publishes it (voice loop feedback). */
   updatePublished(input: UpdatePublishedInput): Promise<void>;
 
@@ -108,6 +141,35 @@ export interface IVoiceStorage {
   /** Get most recent published posts across all platforms, sorted by published_at DESC. */
   getRecentPublished(limit: number): Promise<VoicePost[]>;
 
+  /** Get recent published posts for one author/platform and quality threshold. */
+  getPublishedForAuthor(
+    authorLogin: string,
+    platform: Platform,
+    limit: number,
+    minEditRatio?: number,
+  ): Promise<VoicePost[]>;
+
+  /** Exposure pool query: per-platform, published-only, edit_ratio >= 0.30, deduped by published prefix. */
+  getPublishedForExposure(authorLogin: string, platform: Platform): Promise<VoicePost[]>;
+
+  /** Move-measurement query: cross-platform, published-only, edit_ratio >= 0.30, deduped by published prefix. */
+  getPublishedForMoves(authorLogin: string): Promise<VoicePost[]>;
+
+  /** Get recent top_finding texts for chapter context. */
+  getRecentTopFindings(authorLogin: string | null, moduleId: string, limit: number): Promise<RecentTopFinding[]>;
+
+  /** Get recent outcomes for one author across published/expired rows. */
+  getRecentOutcomes(authorLogin: string, limit: number): Promise<VoicePost[]>;
+
+  /** Count drafts for one author created after the provided ISO timestamp. */
+  countDraftsSince(authorLogin: string, sinceIso: string): Promise<number>;
+
+  /** Count unique published texts for an author, optionally scoped to one platform. */
+  countUniquePublished(authorLogin: string, platform?: Platform): Promise<number>;
+
+  /** Enumerate authors that should be processed by the scanner. */
+  listActiveAuthors(days: number): Promise<string[]>;
+
   /** Check if a commit SHA + platform already has a processed post. */
   hasDraft(commit_sha: string, platform: Platform): Promise<boolean>;
 
@@ -123,9 +185,19 @@ export interface IVoiceStorage {
   /** Get scheduled posts that haven't been matched to a published post yet (for voice loop). */
   getScheduledUnpublished(platform: Platform): Promise<VoicePost[]>;
 
+  /** Mark one or more scheduled rows as expired. */
+  markExpired(ids: string[]): Promise<void>;
+
   /** Claim a scheduling slot atomically. Returns false if slot already taken. */
   claimSlot(slot: SlottedPost): Promise<boolean>;
 
   /** Get all taken slots for a platform on a given day (UTC date string YYYY-MM-DD). */
   getTakenSlots(platform: Platform, dayUtc: string): Promise<Date[]>;
 }
+
+export type {
+  BootstrapPost,
+  ContentStrategy,
+  HookStyle,
+  VoiceProfile,
+};


--- src/voice/supabase-storage.ts
diff --git a/src/voice/supabase-storage.ts b/src/voice/supabase-storage.ts
index ba3de9a..a4b7c87 100644
--- a/src/voice/supabase-storage.ts
+++ b/src/voice/supabase-storage.ts
@@ -1,4 +1,5 @@
 import { createClient, type SupabaseClient } from '@supabase/supabase-js';
+import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../config/schema.js';
 import type {
   IVoiceStorage,
   VoicePost,
@@ -8,9 +9,35 @@ import type {
   UpdateEngagementInput,
   Platform,
   PostStatus,
+  RecentTopFinding,
   SlottedPost,
+  StoredVoiceProfile,
 } from './storage.js';
 
+interface VoiceProfileRow {
+  id: string;
+  github_author_login: string | null;
+  voice: unknown;
+  version: number;
+}
+
+function normalizeVoiceProfile(candidate: unknown): VoiceProfile | null {
+  const parsed = VoiceProfileSchema.safeParse(candidate);
+  if (!parsed.success) return null;
+  return {
+    ...DEFAULT_VOICE_PROFILE,
+    ...parsed.data,
+    content_strategy: {
+      ...DEFAULT_VOICE_PROFILE.content_strategy,
+      ...parsed.data.content_strategy,
+    },
+    post_length: {
+      ...DEFAULT_VOICE_PROFILE.post_length,
+      ...parsed.data.post_length,
+    },
+  };
+}
+
 export class SupabaseStorage implements IVoiceStorage {
   private readonly db: SupabaseClient;
   readonly tenantId: string;
@@ -38,6 +65,8 @@ export class SupabaseStorage implements IVoiceStorage {
         matched_source_id: input.matched_source_id ?? null,
         match_strength: input.match_strength ?? null,
         match_connection: input.match_connection ?? null,
+        generation_system: input.generation_system ?? null,
+        opening_move: input.opening_move ?? null,
         status: 'pending' satisfies PostStatus,
         tenant_id: this.tenantId,
       })
@@ -55,6 +84,7 @@ export class SupabaseStorage implements IVoiceStorage {
         published: input.published,
         edit_ratio: input.edit_ratio,
         published_at: input.published_at,
+        ...(input.edit_analysis !== undefined && { edit_analysis: input.edit_analysis }),
         status: 'published' satisfies PostStatus,
         ...(input.linkedin_urn !== undefined && { linkedin_urn: input.linkedin_urn }),
         ...(input.publish_source !== undefined && { publish_source: input.publish_source }),
@@ -86,6 +116,69 @@ export class SupabaseStorage implements IVoiceStorage {
     if (error) throw new Error(`markQueued failed: ${error.message}`);
   }
 
+  async getVoiceProfile(authorLogin: string | null): Promise<StoredVoiceProfile | null> {
+    const exact = await this.fetchVoiceProfileRow(authorLogin);
+    if (exact) {
+      return {
+        voice: normalizeVoiceProfile(exact.voice) ?? DEFAULT_VOICE_PROFILE,
+        version: exact.version,
+      };
+    }
+
+    if (authorLogin) {
+      const fallback = await this.fetchVoiceProfileRow(null);
+      if (fallback) {
+        return {
+          voice: normalizeVoiceProfile(fallback.voice) ?? DEFAULT_VOICE_PROFILE,
+          version: fallback.version,
+        };
+      }
+    }
+
+    const legacy = await this.loadLegacyVoiceProfile();
+    if (!legacy) return null;
+
+    await this.saveVoiceProfile(null, legacy.voice, legacy.version);
+    return legacy;
+  }
+
+  async saveVoiceProfile(authorLogin: string | null, voice: VoiceProfile, expectedVersion?: number): Promise<boolean> {
+    const normalized = normalizeVoiceProfile(voice) ?? DEFAULT_VOICE_PROFILE;
+    const existing = await this.fetchVoiceProfileRow(authorLogin);
+
+    if (!existing) {
+      if (expectedVersion !== undefined && expectedVersion !== 0) return false;
+
+      const { error } = await this.db
+        .from('voice_profiles')
+        .insert({
+          tenant_id: this.tenantId,
+          github_author_login: authorLogin,
+          voice: normalized,
+          version: 1,
+        });
+
+      if (error) throw new Error(`saveVoiceProfile insert failed: ${error.message}`);
+      return true;
+    }
+
+    if (expectedVersion !== undefined && existing.version !== expectedVersion) return false;
+
+    const nextVersion = existing.version + 1;
+    const { error } = await this.db
+      .from('voice_profiles')
+      .update({
+        voice: normalized,
+        version: nextVersion,
+        updated_at: new Date().toISOString(),
+      })
+      .eq('id', existing.id)
+      .eq('version', expectedVersion ?? existing.version);
+
+    if (error) throw new Error(`saveVoiceProfile update failed: ${error.message}`);
+    return true;
+  }
+
   async getTopVoiceExamples(platform: Platform, limit: number): Promise<VoicePost[]> {
     const { data, error } = await this.db
       .from('voice_posts')
@@ -142,6 +235,155 @@ export class SupabaseStorage implements IVoiceStorage {
     return (data ?? []) as VoicePost[];
   }
 
+  async getPublishedForAuthor(
+    authorLogin: string,
+    platform: Platform,
+    limit: number,
+    minEditRatio = 0.7,
+  ): Promise<VoicePost[]> {
+    const { data, error } = await this.db
+      .from('voice_posts')
+      .select('*')
+      .eq('tenant_id', this.tenantId)
+      .eq('author_login', authorLogin)
+      .eq('platform', platform)
+      .eq('status', 'published')

--- src/voice/utils.ts
diff --git a/src/voice/utils.ts b/src/voice/utils.ts
new file mode 100644
index 0000000..aedd208
--- /dev/null
+++ b/src/voice/utils.ts
@@ -0,0 +1,38 @@
+export function hash(input: string): number {
+  let h = 0x811c9dc5;
+  for (let i = 0; i < input.length; i++) {
+    h ^= input.charCodeAt(i);
+    h = Math.imul(h, 0x01000193);
+  }
+  return h >>> 0;
+}
+
+export function seededRandom(seed: number): number {
+  let t = (seed + 0x6d2b79f5) | 0;
+  t = Math.imul(t ^ (t >>> 15), t | 1);
+  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+}
+
+export function createRng(seed: number): () => number {
+  let state = seed;
+  return () => {
+    state = (state + 0x6d2b79f5) | 0;
+    let t = Math.imul(state ^ (state >>> 15), state | 1);
+    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+  };
+}
+
+export function weightedShuffle<T>(
+  items: Array<{ item: T; weight: number }>,
+  rng: () => number,
+): T[] {
+  return items
+    .map(({ item, weight }) => ({
+      item,
+      sortKey: -Math.log(Math.max(rng(), 0.000001)) / Math.max(weight, 0.001),
+    }))
+    .sort((left, right) => left.sortKey - right.sortKey)
+    .map(({ item }) => item);
+}


--- src/webhook/handlers/onboard.ts
diff --git a/src/webhook/handlers/onboard.ts b/src/webhook/handlers/onboard.ts
index 565f8b5..1032837 100644
--- a/src/webhook/handlers/onboard.ts
+++ b/src/webhook/handlers/onboard.ts
@@ -1,6 +1,9 @@
-import { logger } from '../../utils/logger.js';
 import type { SupabaseClient } from '@supabase/supabase-js';
+import { MODULE_REGISTRY } from '../../analysis/modules/index.js';
+import { DEFAULT_VOICE_PROFILE, VoiceProfileSchema, type VoiceProfile } from '../../config/schema.js';
 import { sealTenantSecrets } from '../../security/tenant-secrets.js';
+import { logger } from '../../utils/logger.js';
+import { mergeVoiceProfile } from '../../voice/profile-utils.js';
 
 interface TenantRow {
   readonly id: string;
@@ -12,12 +15,44 @@ interface TenantRow {
   readonly voice_bootstrap: string | null;
 }
 
+interface VoiceProfileRow {
+  readonly id: string;
+  readonly voice: unknown;
+  readonly version: number;
+}
+
+const MODULE_OPTIONS = MODULE_REGISTRY
+  .map((module) => ({ id: module.id, name: module.name }))
+  .sort((left, right) => left.name.localeCompare(right.name));
+
 function maskToken(token: string | null): string {
   if (!token) return '';
   return 'configured••••••••';
 }
 
-function html(tenant: TenantRow, installationId: number, linkedinClientId: string, appBaseUrl: string, saved: boolean): string {
+function escapeHtml(value: string): string {
+  return value
+    .replaceAll('&', '&amp;')
+    .replaceAll('<', '&lt;')
+    .replaceAll('>', '&gt;')
+    .replaceAll('"', '&quot;')
+    .replaceAll("'", '&#39;');
+}
+
+function checked(value: boolean): string {
+  return value ? 'checked' : '';
+}
+
+function selected(left: string, right: string): string {
+  return left === right ? 'selected' : '';
+}
+
+function html(
+  tenant: TenantRow,
+  installationId: number,
+  voiceProfile: VoiceProfile,
+  saved: boolean,
+): string {
   const cfg = tenant.config;
   const author = (cfg['author'] as Record<string, unknown> | undefined) ?? {};
   const buffer = (cfg['buffer'] as Record<string, unknown> | undefined) ?? {};
@@ -26,10 +61,20 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
   const website = (author['website'] as string | undefined) ?? '';
   const bufferOrgId = (buffer['organization_id'] as string | undefined) ?? '';
   let voiceParts: string[] = [];
-  try { voiceParts = JSON.parse(tenant.voice_bootstrap ?? '[]') as string[]; } catch { voiceParts = []; }
+  try {
+    voiceParts = JSON.parse(tenant.voice_bootstrap ?? '[]') as string[];
+  } catch {
+    voiceParts = [];
+  }
+
+  const focusModules = new Set(voiceProfile.content_strategy.focus_modules ?? MODULE_OPTIONS.map((module) => module.id));
+  const skipPatterns = voiceProfile.content_strategy.skip_patterns.join('\n');
+  const hashtags = voiceProfile.hashtags.join(' ');
   const voice1 = voiceParts[0] ?? '';
   const voice2 = voiceParts[1] ?? '';
   const voice3 = voiceParts[2] ?? '';
+  const voice4 = voiceParts[3] ?? '';
+  const voice5 = voiceParts[4] ?? '';
 
   const linkedinConnected = !!tenant.linkedin_member_id;
   const linkedinSection = linkedinConnected
@@ -42,6 +87,13 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
     ? `<div class="banner"><span class="dot"></span>Saved successfully.</div>`
     : '';
 
+  const moduleCheckboxes = MODULE_OPTIONS.map((module) => `
+    <label class="check-card">
+      <input type="checkbox" name="focus_modules" value="${module.id}" ${checked(focusModules.has(module.id))}>
+      <span>${escapeHtml(module.name)}</span>
+    </label>
+  `).join('');
+
   return `<!DOCTYPE html>
 <html lang="en">
 <head>
@@ -58,22 +110,20 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
     .logo{font-weight:600;font-size:.95rem;letter-spacing:-.02em;color:#fff}
     .account-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #27272a;background:#18181b;padding:4px 12px;border-radius:9999px;font-size:.75rem;color:#a1a1aa}
     .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;flex-shrink:0}
-    main{max-width:480px;margin:48px auto;padding:0 24px 48px}
+    main{max-width:860px;margin:48px auto;padding:0 24px 48px}
     h1{font-size:1.5rem;font-weight:600;color:#fff;letter-spacing:-.02em;margin-bottom:4px}
     .sub{font-size:.875rem;color:#71717a;margin-bottom:32px}
     .banner{display:flex;align-items:center;gap:8px;background:#052e16;border:1px solid #166534;color:#4ade80;padding:10px 14px;border-radius:8px;margin-bottom:24px;font-size:.875rem}
     .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:16px}
-    .section-title{font-size:.875rem;font-weight:600;color:#fff;margin-bottom:16px}
+    .section-title{font-size:.95rem;font-weight:600;color:#fff;margin-bottom:16px}
     .optional{color:#52525b;font-weight:400}
     label{display:block;font-size:.8rem;font-weight:500;color:#a1a1aa;margin-bottom:6px}
-    input[type=text],input[type=url]{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s}
-    input[type=text]:focus,input[type=url]:focus{border-color:#52525b}
-    input::placeholder{color:#3f3f46}
+    input[type=text],input[type=url],input[type=number],select{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s}
+    input[type=text]:focus,input[type=url]:focus,input[type=number]:focus,select:focus,textarea:focus{border-color:#52525b}
+    input::placeholder,textarea::placeholder{color:#3f3f46}
+    textarea{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s;resize:vertical}
     .hint{font-size:.75rem;color:#52525b;margin-top:-12px;margin-bottom:16px}
     .hint-card{font-size:.75rem;color:#52525b;margin-top:10px}
-    textarea{width:100%;padding:8px 12px;background:#09090b;border:1px solid #27272a;border-radius:8px;font-size:.875rem;color:#f4f4f5;font-family:inherit;margin-bottom:16px;outline:none;transition:border-color .15s;resize:vertical}
-    textarea:focus{border-color:#52525b}
-    textarea::placeholder{color:#3f3f46}
     .btn-primary{background:#fff;color:#09090b;border:none;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s}
     .btn-primary:hover{background:#e4e4e7}
     .btn-linkedin{display:inline-flex;align-items:center;gap:8px;background:#0077B5;color:#fff;padding:9px 20px;border-radius:8px;font-size:.875rem;font-weight:500;text-decoration:none;transition:background .15s}
@@ -81,47 +131,125 @@ function html(tenant: TenantRow, installationId: number, linkedinClientId: strin
     .connected{display:inline-flex;align-items:center;gap:6px;color:#34d399;font-size:.875rem;font-weight:500}
     .link-small{font-size:.8rem;color:#52525b;text-decoration:none;margin-left:12px;transition:color .15s}
     .link-small:hover{color:#a1a1aa}
+    .module-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:12px 0 16px}
+    .check-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #27272a;border-radius:10px;background:#09090b;color:#d4d4d8}
+    .check-card input{margin:0}
+    .radio-row{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 16px}
+    .radio-pill{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #27272a;border-radius:9999px;background:#09090b;color:#d4d4d8}
+    .split{display:grid;grid-template-columns:1fr 1fr;gap:16px}
+    @media (max-width: 720px){main{padding:0 16px 40px}.split{grid-template-columns:1fr}}
   </style>
 </head>
 <body>
   <nav>
     <span style="display:inline-flex;align-items:center;gap:8px"><img src="/favicon.png" alt="" style="height:20px;border-radius:4px"><span class="logo">devcast</span></span>
-    <span class="account-badge"><span class="dot"></span>${tenant.github_username}</span>
+    <span class="account-badge"><span class="dot"></span>${escapeHtml(tenant.github_username)}</span>
   </nav>
   <main>
     <h1>Setup</h1>
-    <p class="sub">Configure how devcast generates posts for you.</p>
+    <p class="sub">Configure what devcast publishes, how it sounds, and the examples it should learn from.</p>
     ${banner}

--- src/webhook/server.ts
diff --git a/src/webhook/server.ts b/src/webhook/server.ts
index 0f8099d..8ed1bea 100644
--- a/src/webhook/server.ts
+++ b/src/webhook/server.ts
@@ -57,7 +57,7 @@ const server = createServer((req, res) => {
   }
 
   // Onboarding page
-  if (req.method === 'GET' && path === '/onboard') {
+  if (req.method === 'GET' && (path === '/onboard' || path === '/settings/voice')) {
     const installationId = parseInt(query.get('installation_id') ?? '', 10);
     const saved = query.get('saved') === '1';
     if (isNaN(installationId)) {
@@ -79,7 +79,7 @@ const server = createServer((req, res) => {
   }
 
   // Onboarding form submission
-  if (req.method === 'POST' && path === '/onboard') {
+  if (req.method === 'POST' && (path === '/onboard' || path === '/settings/voice')) {
     const chunks: Buffer[] = [];
     req.on('data', (chunk: Buffer) => chunks.push(chunk));
     req.on('end', () => {


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 22ae3f8..f9a2b82 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -7,6 +7,7 @@ import { runPipeline } from '../analysis/pipeline.js';
 import { MODULE_REGISTRY } from '../analysis/modules/index.js';
 import { createAIClient, createEmbedder } from '../ai/factory.js';
 import { generatePosts } from '../ai/post-generator.js';
+import { buildChapterContext, buildVarietyConstraint } from '../ai/prompt-builder.js';
 import { matchFindingsToArticles } from '../content/matcher.js';
 import { BufferClient } from '../buffer/client.js';
 import { publishToBuffer } from '../buffer/publisher.js';
@@ -18,6 +19,8 @@ import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
 import type { SaveDraftInput } from '../voice/storage.js';
 import { resolveTenantSecrets } from '../security/tenant-secrets.js';
+import { filterFindingsByContentStrategy, matchesSkipPatterns, mergeVoiceProfile } from '../voice/profile-utils.js';
+import { computeVoiceStage } from '../voice/stage.js';
 
 interface TenantRow {
   readonly id: string;
@@ -178,7 +181,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       }
 
       const recentModuleIds = await storage.getRecentModuleIds(30);
-      const findings = await runPipeline(
+      const pipelineFindings = await runPipeline(
         {
           diffs: commit.diffs,
           commitMessage: commit.message,
@@ -191,45 +194,150 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
         recentModuleIds,
       );
 
-      if (findings.length === 0) {
+      if (pipelineFindings.length === 0) {
         logger.info('worker.commit.skip.no_findings', { sha: commit.sha });
         continue;
       }
 
+      const storedVoiceProfile = await storage.getVoiceProfile(commit.authorLogin ?? null);
+      const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
+      const authorLogin = commit.authorLogin ?? null;
+      const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
+      const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
+      const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);
+      const startOfDay = new Date();
+      startOfDay.setUTCHours(0, 0, 0, 0);
+      const todayStartIso = startOfDay.toISOString();
+      const draftsToday = authorLogin ? await storage.countDraftsSince(authorLogin, todayStartIso) : 0;
+      const findings = filterFindingsByContentStrategy(pipelineFindings, voiceProfile);
+
+      if (findings.length === 0) {
+        logger.info('worker.commit.skip.no_findings_after_strategy', {
+          sha: commit.sha,
+          focus_modules: voiceProfile.content_strategy.focus_modules ?? [],
+        });
+        continue;
+      }
+
+      const skipPattern = matchesSkipPatterns(commit, findings, voiceProfile);
+      if (skipPattern) {
+        logger.info('worker.commit.skip.content_strategy', { sha: commit.sha, skipPattern });
+        continue;
+      }
+
+      const fireCounts = new Map<string, number>();
+      for (const moduleId of recentModuleIds) {
+        fireCounts.set(moduleId, (fireCounts.get(moduleId) ?? 0) + 1);
+      }
+      const topModuleId = findings[0]?.moduleId;
+      const topModuleFireCount = topModuleId ? (fireCounts.get(topModuleId) ?? 0) : 0;
+
+      if (topModuleFireCount >= 2 && draftsToday > 0) {
+        logger.info('worker.commit.skip.module_saturation', {
+          sha: commit.sha,
+          module: topModuleId,
+          fireCount: topModuleFireCount,
+          draftIndexToday: draftsToday,
+        });
+        continue;
+      }
+
+      let chapterContext: string | undefined;
+      if (topModuleId && topModuleFireCount >= 1) {
+        const previousFindings = await storage.getRecentTopFindings(authorLogin, topModuleId, 2);
+        if (previousFindings.length > 0) {
+          chapterContext = buildChapterContext(topModuleId, previousFindings, topModuleFireCount + 1);
+        }
+      }
+
+      let exposurePool: Awaited<ReturnType<SupabaseStorage['getPublishedForExposure']>> = [];
+      if (authorLogin && voiceStage !== 'cold') {
+        const poolIds = voiceProfile.voice_examples_pool?.['linkedin'];
+        if (poolIds?.length) {
+          const { data, error } = await deps.db
+            .from('voice_posts')
+            .select('*')
+            .in('id', poolIds);
+          if (!error) exposurePool = (data ?? []) as typeof exposurePool;
+        }
+        if (exposurePool.length === 0) {
+          exposurePool = await storage.getPublishedForExposure(authorLogin, 'linkedin');
+        }
+      }
+
+      let todayFirstOpeningMove: string | undefined;
+      if (authorLogin && draftsToday > 0) {
+        const { data } = await deps.db
+          .from('voice_posts')
+          .select('opening_move')
+          .eq('tenant_id', tenant.id)
+          .eq('author_login', authorLogin)
+          .gte('created_at', todayStartIso)
+          .not('opening_move', 'is', null)
+          .order('created_at', { ascending: true })
+          .limit(1);
+        todayFirstOpeningMove = (data?.[0] as { opening_move?: string } | undefined)?.opening_move;
+      }
+
+      const varietyConstraint = voiceStage !== 'cold'
+        ? buildVarietyConstraint(voiceProfile.recent_opening_sequence ?? [], draftsToday, todayFirstOpeningMove) ?? undefined
+        : undefined;
+
       // Content matching — inject industry context when a strong match is found.
       // Graceful degradation: any failure skips context, post generated normally.
       let industryContext: string | undefined;
       let draftMetadata: Partial<SaveDraftInput> = {
-        author_login: commit.authorLogin,
+        author_login: authorLogin,
+        generation_system: voiceStage === 'cold' ? 'v1' : 'v2_progressive',
       };
       if (embedder) {
-        try {
-          const match = await matchFindingsToArticles(findings, embedder, anthropic, deps.db);
-          if (match) {
-            industryContext = `Connection: ${match.connection}`;
-            draftMetadata = {
-              ...draftMetadata,
-              context_status: 'matched',
-              has_industry_context: true,
-              matched_article_id: match.articleId,
-              matched_source_id: match.sourceId,
-              match_strength: match.matchStrength,
-              match_connection: match.connection,
-            };
-            logger.info('content.match.injected', { sha: commit.sha, article: match.articleTitle });
-          } else {
-            draftMetadata = {
-              ...draftMetadata,
```

### Commit 7: b1c20cc
**Message:** feat: expand seed corpus with architecture and ai batch

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index 0b74b2c..bd1be75 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -68,3 +68,9 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 67,track2,performance,"integration,complexity",https://www.linkedin.com/blog/engineering/infrastructure/optimizing-linkedin-sales-navigators-search-pipeline-with-spark,"Optimizing LinkedIn Sales Navigator’s search pipeline with Spark","LinkedIn Engineering Blog","Chunxu Tang; Yanji Jia; Puneet Singh Ahluwalia; Yuou Lei",2025-07-23,8,"A production data-pipeline optimization story with concrete runtime wins while migrating a 100+ job search-index build from MapReduce to Spark.",kept,,
 68,track2,architecture_patterns,"error_resilience,performance",https://www.linkedin.com/blog/engineering/infrastructure/rethinking-hfds-block-placement-for-exabyte-scale-clusters,"Scaling maintenance: Rethinking HDFS block placement for exabyte-scale clusters","LinkedIn Engineering Blog","Ponmani Palanisamy",2026-01-22,9,"Excellent large-scale infrastructure article on redesigning block placement and maintenance workflows across exabyte-scale HDFS clusters under strict availability constraints.",kept,,
 69,track2,security,"architecture_patterns,devops",https://www.linkedin.com/blog/engineering/infrastructure/securing-every-kubernetes-workload-at-scale,"Securing every Kubernetes workload at scale","LinkedIn Engineering Blog","Rahul Godha; Yogesh Patil",2026-02-26,9,"High-signal platform security post on workload identity, cert-manager scaling, and stronger trust guarantees across large multi-cluster Kubernetes fleets.",kept,,
+70,track2,api_design,"integration,dependency_health,evolutionary",https://www.linkedin.com/blog/engineering/talent/driving-data-enhancement-and-recruitment-success-with-linkedins-unified-integrations,"Driving data enhancement & recruitment success with LinkedIn’s unified integrations","LinkedIn Engineering Blog","Aditya Hegde; Gaurav Sisodiya",2026-03-10,9,"Excellent contract-and-integration article: canonical schemas, idempotent replay, gradual rollout, and a real platform outcome with onboarding time reduced by 72%.",kept,,
+71,track2,architecture_patterns,"api_design,error_resilience",https://www.linkedin.com/blog/engineering/infrastructure/engineering-linkedins-job-ingestion-system-at-scale,"Engineering LinkedIn's job ingestion system at scale","LinkedIn Engineering Blog","Anvesh Uppoora; Rishav Kumar; Avinash Permude",2026-01-29,9,"A strong ingestion-platform write-up covering modular event-driven pipelines, state-machine coordination, specialized miners, and lifecycle guarantees at LinkedIn scale.",kept,,
+72,track2,design_patterns,"api_design,dx",https://github.blog/engineering/architecture-optimization/introducing-sub-issues-enhancing-issue-management-on-github/,"Introducing sub-issues: Enhancing issue management on GitHub","The GitHub Blog","Shaun Wong",2025-04-11,8,"Useful engineering post on data-model design, GraphQL exposure, hierarchy rollups, and dogfooding a feature by building it on top of itself.",kept,,
+73,track2,ai_assisted,"architecture_patterns,dx",https://dashbit.co/blog/the-path-to-tidewave,"The path to Tidewave: beyond code intelligence","Dashbit Blog","José Valim",2025-06-06,8,"A thoughtful architecture article on giving AI agents runtime intelligence instead of static code context alone, with concrete MCP and REPL integration ideas.",kept,,
+74,track2,ai_assisted,"dx,architecture_patterns",https://www.linkedin.com/blog/engineering/ai/contextual-agent-playbooks-and-tools-how-linkedin-gave-ai-coding-agents-organizational-context,"Contextual agent playbooks and tools: How LinkedIn gave AI coding agents organizational context","LinkedIn Engineering Blog","Ajay Prakash; Nikhilesh Payyavuala",2026-01-27,9,"High-signal AI-assistance post focused on making coding agents effective inside a large engineering org by wiring them to trusted workflows, tools, and internal context.",kept,,
+75,track2,ai_assisted,"performance,concurrency",https://www.linkedin.com/blog/engineering/ai/scaling-llm-based-ranking-systems-with-sglang-at-linkedin,"Scaling LLM-Based ranking systems with SGLang at LinkedIn","LinkedIn Engineering Blog","Sundara Raman Ramachandran; Qing Lan; Chanh Nguyen; Jian Sheng; Chuanrui Zhu",2026-02-20,9,"Excellent production inference article on batching, scoring-only execution, KV reuse, and CPU/GPU coordination for prefill-only ranking at LinkedIn scale.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index e0527b7..d09df50 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -824,5 +824,78 @@
       "performance",
       "complexity"
     ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/talent/driving-data-enhancement-and-recruitment-success-with-linkedins-unified-integrations",
+    "title": "Driving data enhancement & recruitment success with LinkedIn\u2019s unified integrations",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "From the outside, hiring can look like a single, continuous flow. A candidate applies. A recruiter messages them. Interviews are scheduled. Feedback is collected. An offer is made. Behind the scenes, the process spans multiple systems: an Applicant Tracking System (ATS) to manage applications and stages, a Talent Candidate Relationship Management (TCRM a.k.a CRM) for sourcing and outreach, and separate tools for scheduling, assessments, and onboarding. Each system holds part of the story, and recruiters piece it together to make timely decisions. Figure 1: Systems across interactions between recruiters and candidates LinkedIn processes millions of job applications and hundreds of thousands of job postings every week across dozens of partner integrations. Small inconsistencies such as delayed updates, mismatched schemas, or missing entities can slow recruiters down and reduce confidence in the data they rely on. At LinkedIn\u2019s scale, these issues can compound quickly. Preventing these problems is especially crucial as recruiting workflows increasingly leverage AI assistance. For AI systems to function reliably, the data must be complete, up-to-date, and internally consistent. Achieving this requires ingesting and reconciling millions of records per customer, along with ongoing incremental updates across thousands of entities each hour. In this post, we\u2019ll explain how we developed a unified integrations platform to standardize, reconcile, and deliver hiring data at scale\u2014a multi-year effort. The result: partner onboarding time reduced by 72%, data coverage expanded, and data completeness significantly improved. This foundation has also enabled LinkedIn\u2019s Hiring Assistant to consume and reason over a unified, consistent view of hiring data across systems. Integrations are critical in an agentic world because they ground agents in unified enterprise context and canonical data while enabling secure, governed, and auditable closed-loop actions transforming them from passive advisors into trusted enterprise operators. The need for BuildIn and BuildOut BuildIn is a partner-push integration model where ATS and TCRM platforms send entities to LinkedIn through APIs and receive updates via webhooks. It enables rapid onboarding and supports partners that lack mature public APIs, but data completeness, freshness, and schema evolution depend heavily on partner implementations and coordination. BuildOut , on the other hand, is a LinkedIn-owned pull and push integration model designed for partners with robust public APIs. LinkedIn fetches data on a controlled cadence, performs validation, backfills, enriches data, and executes write-backs through partner APIs with synchronous status handling. This provides stronger guarantees around data completeness, freshness, observability, idempotency, and error recovery, while establishing the partner system as the system of record. Partner ecosystems are heterogeneous, evolving, uneven in API maturity, and large production integrations cannot be re-platformed overnight. Supporting both models allows the platform to cover the full spectrum of partner capabilities. BuildIn ensures baseline connectivity and workflow continuity for less mature integrations, while BuildOut delivers higher data quality, control, and reliability where APIs permit. In practice, most partners operate in a hybrid mode, with some entities pushed and others pulled. This coexistence enables incremental data quality improvements, lower operational risk, faster onboarding, and progressive migration toward more resilient patterns - while maintaining a unified, canonical data layer required for systems like LinkedIn\u2019s Hiring Assistant to reason and act consistently across enterprises. Unique challenges At first glance, integrating hiring systems may seem like simply wiring APIs together. In reality, each partner\u2019s unique entity models, data lifecycles, and operational constraints combined with production-scale volumes and long-lived customer expectations turn integration into an ongoing exercise in managing complexity rather than just enabling connectivity. Semantic variability Partners model the same real-world concepts differently. A candidate may be a standalone profile in one system and job-scoped in another. Resumes may attach to candidates in some platforms and to applications in others. Identifiers may be globally unique, scoped per job, or even regenerated during lifecycle transitions. These differences make direct schema alignment fragile. Entity interdependency Hiring data is also deeply interconnected. Candidates link to multiple applications; applications depend on jobs; resumes, interviews, and feedback often live on separate surfaces. A partial update in one entity can require coordinated updates across others. Maintaining consistency across these relationships becomes difficult at scale. Operational scale & evolution Operational constraints add another layer of complexity. Initial bootstraps can involve millions of records per tenant, while steady-state syncs process thousands of updates per hour. Partners enforce diverse quota limits, and webhook signals may be incomplete or inconsistent. Meanwhile, APIs and schemas evolve over time, and integrations must adapt without disrupting existing customers. These constraints require more than a single integration pattern. They demand a system that absorbs partner variability, preserves identity stability, manages interdependencies, and evolves safely under continuous load. Design principles As our integration surface expanded, it became clear that reliability could not emerge organically. To operate predictably across heterogeneous partners and production-scale workloads, we codified a small set of design principles that shaped how the platform ingests, synchronizes, exposes, and evolves hiring data. Secure, isolated, and observable by default Security is enforced as a foundational architectural constraint rather than an afterthought. Partner credentials, tenant data, and hiring entities are strictly isolated, auditable, and protected across all layers of the platform. At the same time, correctness is made observable: data freshness, completeness, lag, and failure modes are continuously measured and surfaced, enabling early detection and recovery before issues impact recruiter workflows or automation. Unified data contracts with flexible integration and consumption The platform is partner and channel-agnostic by design, absorbing data from multiple integration channels: BuildIn APIs and BuildOut flows without exposing downstream consumers to source-specific behavior. While ingestion paths may vary, all data converges on a single, consistent contract that can be consumed flexibly via APIs for online workflows, event streams for near-real-time processing, or offline tables for analytics and machine learning. Idempotent, replayable, and safe to evolve Integrations are long-lived and failures are inevitable, so every data path is designed to be idempotent and replayable. This enables safe retries, backfills, and reprocessing without corrupting state. The platform supports gradual rollout, bidirectional read/write collaboration, selective overrides, rollback, and automated recovery allowing new capabilities and schema changes to be introduced incrementally without disrupting existing customers or workflows. Our solution With these principles in place, the solution takes shape as a modular integration platform. BuildIn and BuildOut gateway adapters handle partner-facing variability, while a centralized integration core - backed by transformation, enrichment, and orchestration drives consistent, bidirectional data flow between LinkedIn Recruiter and external systems. High level architecture The key insight from this journey was that integration maturity is not binary. Rather than replacing push-based integrations with pull-based ones, we designed for coexistence, identity decoupling, and deterministic routing. This allowed the platform to increase control over data quality while evolving safely across a heterogeneous partner ecosystem. Figure 2. High level architecture The architecture is composed of the following core components: BuildIn framework To reiterate, in this model, partner platforms initiate communication and synchronize hiring entities such as job requisitions, applications, candidates, and resumes into LinkedIn systems through public APIs and receive updates via webhooks. Secure integration is enforced through OAuth-based authentication and strict tenant isolation. API calls return explicit processing statuses and entity identifiers, allowing partners to track operations reliably and implement structured retry and recovery logic. Batch-oriented endpoints support high-throughput synchronization, while webhook notifications propagate LinkedIn-side events back to partner systems. BuildIn works well for partners that prefer to drive synchronization logic on their side or do not expose mature public APIs. It provides predictable integration surfaces but places greater responsibility on partners for ensuring data completeness, freshness, and lifecycle consistency over time. BuildOut framework The BuildOut framework is LinkedIn\u2019s bidirectional integration engine for partners with mature public APIs. Unlike BuildIn, which relies on partner-initiated pushes, BuildOut gives LinkedIn controlled access to partner systems for both pulling and pushing data, enabling stronger guarantees around completeness, freshness, and reliability. As shown in the architecture diagram below, the framework is composed of three primary components: Activation, Data Manager, and Data Workflow. Figure 3. BuildOut framework and its components Activation & credential management Activation starts within the LinkedIn Recruiter administrator interface, where customers enable partner integrations. Integration metadata is provisioned and partner credentials are securely stored with strict tenant isolation. Credential management is decoupled from runtime workflows, allowing configuration changes and token rotation without disrupting synchronization. Data manager: sync strategy control plane The data manager acts as the control plane for synchronization. It determines how and when entities are retrieved or written, supporting bootstrap backfills, incremental polling, event-based updates, or hybrid combinations depending on partner maturity. Long-running and dependency-aware workflows are orchestrated using Temporal , a durable workflow engine that guarantees retries and deterministic recovery. Incremental updates and change signals flow through Kafka, forming the streaming backbone of the system. Smart throttling: quota-aware freshness control Partner APIs differ widely in rate limits and webhook completeness. To operate predictably under these constraints, the BuildOut framework incorporates smart throttling within the data manager. Instead of issuing one API call per change event, the system buffers signals within short time windows and performs batched incremental pulls. Concurrency, retries, and execution pacing are dynamically adjusted to respect partner quotas while maintaining acceptable data freshness. Because throttling decisions are integrated with Temporal-based workflows and Kafka-driven event signals, the platform adapts to workload spikes and partner-specific limits without compromising correctness or tenant isolation. Data workflow: raw persistence, transformation, and bidirectional sync The data workflow executes both pull and push operations, with transformation as a bidirectional capability at its core. Pull path: Partner \u2192 LinkedIn On the pull path, partner data is retrieved via HTTP connectors and persisted as raw entities in Espresso , LinkedIn\u2019s distributed multi-tenant store. Changes generate events on Kafka, and a Transformation Service converts partner schemas into LinkedIn\u2019s unified canonical entity model before writing entities downstream. Semantic variability is resolved through a configuration-driven model composed of three constructs: The entity defines the structure of the partner API response. The connector defines how the entity is retrieved, including authentication, pagination, retries, and incremental sync strategy. The edge defines explicit field-level mappings from the partner entity to LinkedIn\u2019s canonical entity. Semantic alignment occurs declaratively in the edge configuration. Each canonical field maps to a partner source path and may reference a predefined transformation primitive. These primitives normalize structural and type differences such as extracting nested values, flattening arrays, restructuring objects, converting ISO timestamps to epoch time, stringifying identifiers, and many more. Because mappings are explicit and reusable, transformation becomes deterministic and replayable rather than hard-coded. For example, a partner may represent email addresses as an array of typed objects, while the canonical model expects a list of strings. The mapping specifies both the source path and the transformation needed to extract and normalize the values. Similarly, ISO timestamps are converted into uniform epoch time semantics. Raw records are persisted before transformation to enable replay, debugging, and safe recovery without re-pulling data. Push path: LinkedIn \u2192 Partner The same transformation model operates in reverse for write-back flows. When systems such as LinkedIn Recruiter or Hiring Assistant initiate an action, the request is expressed in LinkedIn\u2019s canonical entity format. Before invoking the partner API, the transformation service maps the canonical entity into the partner-specific schema using the reverse edge configuration. Structural reshaping, identifier translation, and value normalization are applied symmetrically. For instance, if LinkedIn stores phone numbers as a list of strings but the partner expects structured objects, the reverse transformation reconstructs the required format. Canonical identifiers are also mapped back to partner-specific identifiers to preserve system-of-record consistency. By centralizing this bidirectional transformation logic in a declarative layer, the platform isolates partner variability at the integration boundary while maintaining a stable canonical contract for all downstream systems. Operating at scale In production, bootstraps average millions of records per customer, with some reaching tens of millions. Steady-state synchronization processes thousands of updates per hour per tenant. These volumes require durable orchestration, quota-aware execution, and replay-safe persistence. The combination of Temporal, Kafka, Espresso, and Smart Throttling enables predictable behavior across tenants - even under large backfills and continuous update workloads. Integration core If the BuildOut framework governs how data is acquired and written across partner systems, the Integration core defines how that data is normalized, reconciled, and exposed internally. The core represents the canonical boundary of the platform. Beyond this point, downstream systems no longer reason about integration paths or partner schemas. They operate exclusively on unified entity contracts. As shown in the architecture diagram, the core is composed of three primary subsystems: Unification through Standardization and Enhancement Serving via Orchestration through APIs, Event Streams and Offline Tables Data Quality Framework ensuring monitoring, alerting and auto correction Figure 4. Integration core and its components Unification: standardization and enhancement Data from Build-In and Build-Out ingestion paths converges in the unification layer. Standardization The first stage of unification is handled by the Standardization Service (STZ). STZ transforms ingestion-specific entities into a normalized, unified schema and enforces schema contracts across integration paths. It aligns structures, normalizes attributes, and maintains explicit mappings between external partner identifiers and internal canonical identifiers. Each entity is assigned a stable Integration ID, which serves as the durable internal identity. Partner-specific identifiers (Client IDs) are mapped to this Integration ID, decoupling internal identity from external systems while preserving traceability and enabling safe replay and deterministic write-back. Enhancement While standardization ensures structural consistency, enhancement resolves multi-source ambiguity. In hybrid environments, entities may originate from multiple ingestion paths. The platform applies configuration-driven reconciliation policies ensuring a single source of truth for downstream applications. Precedence can be defined at the entity or attribute level, with timestamp-aware conflict resolution ensuring predictable outcomes. The reconciled result is persisted as an enhanced entity in Espresso. From this point forward, downstream systems operate exclusively on this unified representation. On the write-back path, updates to canonical entities are routed to the appropriate source system based on the customer\u2019s enabled integration. The result of a configuration overriding description and location from BuildOut is presented below: Figure 5. Entity enhancement Serving layer Once enhanced entities are persisted, the serving layer makes them available for consumption. Orchestration The orchestration layer coordinates entity workflows (both read and write) that depend on unified entity state, ensuring ordering guarantees where required, controlled propagation of updates, and the triggering of downstream feature workflows. This layer exposes ID Mapping as a service to downstream consumers, enabling end-to-end traceability and enforcing deterministic one-to-one identity resolution across systems. Consumption interfaces Enhanced entities are exposed through three primary modes: APIs \u2013 For synchronous product workflows - both read and write (e.g., Recruiter interactions) Event streams (Kafka) \u2013 For near-real-time consumers and downstream systems Offline tables \u2013 For analytics, indexing, and machine learning pipelines Consumers interact only with the canonical entity contract and Integration IDs. They are insulated from ingestion complexity, partner variability, and synchronization strategies. Data quality framework As the adage goes, \u201c You can\u2019t improve what you don\u2019t measure.\u201d This layer computes a comprehensive set of business and system metrics across multiple categories. Examples include data quality metrics such as applications without resumes or jobs without applications, as well as feature and agentic metrics like applicant evaluation accuracy. It also surfaces issues related to quality, completeness, and freshness across different data channels, including enhanced entities. Acting as a continuous health check for the platform, this layer detects and highlights anomalies across data systems, alerting when threshold breaches. It operates on offline, ETL-processed entity datasets from BuildIn, BuildOut, and enhanced pipelines, using robust and scalable workflows to compute these metrics efficiently. Why the integration core matters Together, these subsystems create a strict boundary between integration variability and product logic - ensuring that downstream consumers, including Hiring Assistant, operate on stable, reconciled entities without exposure to partner-specific complexity. Perception and action interface for LinkedIn\u2019s Hiring Assistant The unified integrations platform acts as the perception and action boundary for intelligent systems with Hiring Assistant as one of its first major consumers grounding agents in canonical enterprise context and system-of-record entities while enabling secure, governed, and auditable closed-loop operations. By providing deterministic, permissioned, and idempotent interfaces for reading, updating, and triggering workflows, and by enforcing identity resolution and access controls, it transforms agents from passive advisors into trusted enterprise operators. Perception Hiring Assistant consumes entities exclusively from the integration core. Because ingestion paths converge through standardization, enhancement, and identity reconciliation, Hiring Assistant reasons over canonical, reconciled entities rather than partner-specific payloads. Stable Integration IDs and unified schemas provide consistent context across candidates, applications, and jobs. Action When Hiring Assistant initiates actions - such as updating application stages or writing structured evaluations - the request is routed through the Integration ID mapping layer. The system resolves the canonical identity, determines the appropriate integration path, and executes the operation with deterministic retries and quota-aware controls. By separating perception from ingestion and action from partner identity, the platform enables AI-driven workflows to operate safely within the same correctness and governance guarantees as human-initiated operations. Results The unified integrations platform delivered measurable improvements across onboarding speed, data quality, and operational stability. Reduced partner onboarding time: To onboard a partner via BuildIn typically would require 12+ months that includes API assessment, contract, design, implementation, validation, beta and GA. With the BuildOut framework we\u2019ve optimized the time from 12+ months to 4 months. With this optimization it helps us in resourcing multiple partners in parallel reducing onboarding time by 72%. Expanded data coverage: By adopting a pull-capable, configuration-driven BuildOut model, the platform expanded available data coverage by 4\u00d7. For example, resume ingestion evolved from limited or missing payloads to nine populated fields with actual resume, and job requisition schemas grew from nine to sixteen fields. The model also enabled new entity types to be onboarded in weeks rather than months, significantly reducing integration friction and accelerating downstream feature delivery. Improved data completeness: By shifting to controlled synchronization and persisting raw partner records, the platform gained the ability to detect gaps, replay missing data, and safely reprocess entities without re-pulling unnecessarily. This reduced inconsistencies such as job requisitions without linked applications and applications missing resumes. In many cases, applications without resumes dropped to less than 10%, significantly improving reliability across workflows and analytics. Validated at scale: During charter launch, the platform ingested millions of records per tenant - often averaging around 5 million during bootstrap - without operational disruption. Incremental syncs processing thousands of updates per hour operated under Smart Throttling controls, validating predictable performance under production load. Foundation for intelligent systems: The platform now provides a unified perception and action surface for systems such as Hiring Assistant, with future consumers across Learning and Sales Solutions building on the same foundation. Modern enterprise workflows demand more than connectivity - they require identity stability, deterministic reconciliation, and controlled evolution across heterogeneous systems. By separating ingestion, unification, and serving, the unified integrations platform converts partner variability into stable, product-ready contracts. What began as an integration modernization effort has become a foundational layer for scalable, cross-product intelligence - supporting agent-driven workflows across hiring, learning, and beyond. Acknowledgements Bringing LinkedIn's unified integrations platform to life has been both challenging and deeply rewarding. This milestone reflects the incredible cross-functional collaboration across product engineering, product management, product marketing management, design, agent Infrastructure, core AI, partners and our early charter customers. Tight co-design across teams, partners and customers enabled us to deliver an integration layer that is technically robust and truly valuable, powering Hiring Assistant with unified, high-quality hiring data and grounded actions. It represents a major product milestone and a testament to what's possible when diverse teams work together to innovate at scale.",
+    "quality_score": 9,
+    "modules": [
+      "api_design",
+      "integration",
+      "dependency_health",
+      "evolutionary"
+    ]
+  },
+  {
+    "url": "https://github.blog/engineering/architecture-optimization/introducing-sub-issues-enhancing-issue-management-on-github/",
+    "title": "Introducing sub-issues: Enhancing issue management on GitHub",
+    "source_name": "The GitHub Blog",
+    "text": "Explore the iterative development journey of GitHub\u2019s sub-issues feature. Learn how we leveraged sub-issues to build and refine sub-issues, breaking down larger tasks into smaller, manageable ones. April 11, 2025 | 5 minutes Share: Recently we launched sub-issues , a feature designed to tackle complex issue management scenarios. This blog post delves into the journey of building sub-issues, what we learned along the way, how we implemented sub-issues, and the benefits of being able to use sub-issues to build itself. What are sub-issues? Sub-issues are a way to break a larger issue into smaller, more manageable tasks. With this feature, you can now create hierarchical lists within a single issue, making it easier to track progress and dependencies. By providing a clear structure, sub-issues help teams stay organized and focused on their goals. For example, I often realize that a batch of work requires multiple steps, like implementing code in different repositories. Breaking this task into discrete sub-issues makes it easier to track progress and more clearly define the work I need to do. In practice we\u2019ve noticed this helps keep linked PRs more concise and easier to review. A brief history Issues have long been at the heart of project management on GitHub. From tracking bugs to planning feature development, issues provide a flexible and collaborative way for teams to organize their work. Over time, we\u2019ve enriched this foundation with tools like labels, milestones, and task lists, all to make project management even more intuitive and powerful. One of the key challenges we set out to solve was how to better represent and manage hierarchical tasks within issues. As projects grow in complexity, breaking down work into smaller, actionable steps becomes essential. We want to empower users to seamlessly manage these nested relationships while maintaining the simplicity and clarity GitHub is known for. Our journey toward sub-issues began with a fundamental goal: to create a system that integrates deeply into the GitHub Issues experience, enabling users to visually and functionally organize their work without adding unnecessary complexity. Achieving this required careful design and technical innovation. Building sub-issues To build sub-issues, we began by designing a new hierarchical structure for tasks rather than modifying the existing task list functionality. We introduced the ability to nest tasks within tasks, creating a hierarchical structure. This required updates to our data models and rendering logic to support nested sub-issues. From a data modeling perspective, the sub-issues table stores the relationships between parent and child issues. For example, if Issue X is a parent of Issue Y, the sub-issues table would store this link, ensuring the hierarchical relationship is maintained. In addition, we roll up sub-issue completion information into a sub-issue list table. This allows us to performantly get progress without having to traverse through a list of sub-issues. For instance, when Issue Y is completed, the system automatically updates the progress of Issue X, eliminating the need to manually check the status of all sub-issues. We wanted a straightforward representation of sub-issues as relationships in MySQL. This approach provided several benefits, including easier support for sub-issues in environments like GitHub Enterprise Server and GitHub Enterprise Cloud with data residency. We exposed sub-issues through GraphQL endpoints, which let us build upon the new Issues experience and leverage newly crafted list-view components. This approach provided some benefits, including more efficient data fetching and enhanced flexibility in how issue data is queried and displayed. Overall, we could move faster because we reused existing components and leveraged new components that would be used in multiple features. This was all made possible by building sub-issues in the React ecosystem. We also focused on providing intuitive controls for creating, editing, and managing sub-issues. To this end, we worked closely with accessibility designers and GitHub\u2019s shared components team that built the list view that powers sub-issues. Our goal was to make it as easy as possible for users to break down their tasks without disrupting their workflow. Using sub-issues in practice Dogfooding is a best practice at GitHub and it\u2019s how we build GitHub! We used sub-issues extensively within our own teams throughout the company to manage complex projects and track progress. Having a discrete area to manage our issue hierarchy resulted in a simpler, more performant experience. Through this hands-on experience, we identified areas for improvement and ensured that the feature met our high standards. Our teams found that sub-Issues significantly improved their ability to manage large projects. By breaking down tasks into smaller, actionable items, they maintained better visibility and control over their work. The hierarchical structure also made it easier to identify dependencies and ensure nothing fell through the cracks. Gathering early feedback Building sub-issues was a team effort. Feedback from our beta testers was instrumental in shaping the final product and ensuring it met the needs of our community. For example, understanding how much metadata to display in the sub-issue list was crucial. We initially started with only issue titles, but eventually added the issue number and repository name, if the issue was from another repository. Building features at GitHub makes it really easy to improve our own features as we go. It was really cool to start breaking down the sub-issues work using sub-issues. This allowed us to experience the feature firsthand and identify any pain points or areas for improvement. For example, the has:sub-issues-progress and has:parent-issue filters evolved from early discussions around filtering syntax. This hands-on approach ensured that we delivered a polished and user-friendly product. These lessons have been invaluable in not only improving sub-issues, but also in shaping our approach to future feature development. By involving users early and actively using our own features, we can continue to build products that truly meet the needs of our community. These practices will be important to our development process going forward, ensuring that we deliver high-quality, user-centric solutions. Call to action Sub-issues are designed to help you break down complex tasks into manageable pieces, providing clarity and structure to your workflows. Whether you\u2019re tracking dependencies, managing progress, or organizing cross-repository work, sub-issues offer a powerful way to stay on top of your projects. We\u2019d love for you to try sub-issues and see how they can improve your workflow. Your feedback is invaluable in helping us refine and enhance this feature. Join the conversation in our community discussion to share your thoughts, experiences, and suggestions. Thank you for being an integral part of the GitHub community. Together, we\u2019re shaping the future of collaborative development! Written by GitHub Sr. Software Engineer Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "design_patterns",
+      "api_design",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://dashbit.co/blog/the-path-to-tidewave",
+    "title": "The path to Tidewave: beyond code intelligence",
+    "source_name": "Dashbit Blog",
+    "text": "Jos\u00e9 Valim June 6th, 2025 tidewave , phoenix A couple of weeks ago we launched Tidewave.ai , an upcoming collection of tools that speed up development with AI agents by understanding your web application, how it runs, and what it delivers. Our initial release is an MCP server for Phoenix and Rails, with more frameworks coming soon. In this article, we explore our general vision for Tidewave with some hints about where we will go next. Code is static, systems are in motion When writing code, developers think of their programs as text, and use the compiler as a black box to convert text into executable code. From the compiler\u2019s point of view, the text doesn\u2019t matter much: a variable accurately named users_length is not really different from using one called l . At some point, the compiler will assign them an index, and care only about the structure rather than text. With AI, computers also gained a textual understanding of our programs. However, we have seen little work towards connecting the textual and structured parts of our programs. For quite some time, the main efforts towards this area were to attach grammars to LLMs , but most other efforts were brushed off with the rationale that models are (or will become) smart enough and therefore we should let them do their own thing. We are finally seeing a move towards more integrated solutions. For example, some agentic tools use tree-sitter to parse all files in a project to provide more structured information instead of sending your whole codebase to a model. The Zed editor also does an excellent job at integrating some editor features, such as diagnostics and code actions, into their agentic workflows. However, most tools still constrain themselves to a static understanding of our code. At best they run terminal commands to interact with our projects, leaving off the table all of the wonderful things that happen when our code runs: logs, traces, database connections, exceptions, and so on. That\u2019s the first problem we aim to solve in our initial release of Tidewave . We connect editors and AI assistants to the language runtime, giving them direct access to logs, databases, documentation, build tools, and yes\u2026 the REPL too. Because if you are more productive with a REPL, then so will the agent. You can even ask which WebSocket connections are currently open or query the background jobs running right now. We achieve this by running an MCP server within your web application. We call it runtime intelligence . The ability to run code within your project cannot be overstated. Imagine you want to integrate with GitHub to streamline your vibe-coding experience. One option is to use GitHub\u2019s MCP server and have AI wrangle a series of calls to get the job done. With Tidewave, you can write the workflow you want within your project using your favorite language\u2019s GitHub client (or ask AI to write it), version control that in, and then prompt your editor to use this code from now on. Tidewave is effectively the one MCP server to rule them all. The value we deliver is not code If you are building a mobile app or web application, much of its value is tied to the user experience it provides. On the other hand, financial, infrastructure, and governmental systems will be comfortable with letting UX take the back seat if it means prioritizing other aspects such as security, reliability, and privacy. I hypothesize that the more AI understands what we actually deliver , the more useful it will be. When it comes to user interfaces, we have already seen many examples of incorporating AI\u2019s vision abilities into the process, from tldraw\u2019s make real to Bolt , and there is still a lot to explore. But here\u2019s the rub: it is not enough to simply put AI on top of our UIs or make it read benchmark results or security reports. For them to be truly useful, they need to understand how an interface was generated, have the ability to profile code, etc. In other words, they need to grasp how the code, the runtime behavior, and the value we deliver all relate to each other, as developers would have to. That\u2019s our upcoming milestone for Tidewave. AI for augmentation, not replacement While there is a lot of speculation around AI displacing developers, I\u2019m far more interested in using AI to enhance our productivity and our tools. If we\u2019re reaching for the stars, why not aspire to make every developer a 10x developer? Take web development. Throughout a typical workday, a developer may alternate between coding, managing version control, writing tests or performing quality assurance, designing or implementing user interfaces, optimizing database performance, crafting user experiences, and handling various specialized tasks. This constant context-switching should sound familiar to most web developers. And it is impossible for anyone to excel at all of those tasks. Each person will master and enjoy them at different skill levels. Over the last weeks, I have used LLMs to bring Figma designs to life, brainstorm our landing page copy, customize our 404 page , port patches from our Tidewave adapter for Phoenix to our Tidewave adapter for Rails , and more. Those are all things I could do by myself - at different proficiency levels - but delivered them at a fraction of the time with the help of AI. I find AI especially useful in helping me find my \u201cproductivity zone\u201d. While I can implement a Figma design from scratch, I am way more comfortable refactoring and enhancing an existing page. If AI provides me with a draft of the page, I can hit the ground running. More specifically, I am not expecting it to be perfect, it just needs to give me a leg up. If it completely fails, the upfront time invested into it is typically a couple of minutes. If it turns out to be exactly what I wanted, that\u2019s even better. At the end of the day, I am not using AI to deliver something I wouldn\u2019t have delivered myself. I am still reviewing the code, updating the documentation, ensuring the tests align with business requirements, etc. Once the task is complete, I\u2019ll submit a pull request, get feedback, and improve myself, regardless if the bulk of the code came from my brain, Stack Overflow, or an LLM. As the team behind Claude Code recently said in a podcast : \u201cIt is still up to the individual to be responsible for code to be well maintained, well documented, with reasonable abstractions\u201d. For each of the tasks performed daily by a web developer mentioned above, ask yourself: how can AI bring me to my productivity zone? To me, this is the real promise of AI for developers: eliminating the valleys in our skills while maximizing our unique peaks. Localhost is not going anywhere Roughly a decade ago, we saw an emergence of remote development environments, such as GitPod and GitHub Codespaces. They came with promises of eliminating environment inconsistencies, streamlining onboarding, reducing hardware requirements, and enabling development from any device. Despite significant advancements and genuine benefits for certain use cases, the promise that most development will happen remotely did not come to pass. Local development\u2019s fundamental advantages of speed, reliability, and control proved too valuable to relinquish. With AI agents getting widespread adoption, remote development environments are gaining new momentum as a critical infrastructure layer for continuous AI-assisted development. After all, you do want your agents to continue designing, code crunching, and testing while you drive to the nearest coffee shop or while you take a computer break to get your ten thousand steps in. The most recent AI coding platforms aim to control your whole development environment and deployment pipeline, making programming more accessible and productive across a range of use cases. However, in the same way containers became the foundation for remote development environments, they also augmented local development with additional security and consistency guarantees. The benefits of localhost are here to stay, which is why we believe it\u2019s equally important to bring new AI tools to the code running on your machine (and your containers).",
+    "quality_score": 8,
+    "modules": [
+      "ai_assisted",
+      "architecture_patterns",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/ai/contextual-agent-playbooks-and-tools-how-linkedin-gave-ai-coding-agents-organizational-context",
+    "title": "Contextual agent playbooks and tools: How LinkedIn gave AI coding agents organizational context",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "In early 2025, we set out to solve a challenge facing most engineering organizations exploring AI-assisted development: AI coding agents are incredibly capable, but they struggle to understand your company. They don\u2019t inherently know your services, frameworks, tribal knowledge, data systems, infrastructure, or your code patterns. And as engineers understand, context is everything. Facing that challenge drove us to consider a simple question: How can we help AI coding agents understand LinkedIn well enough to help our engineers? The answer became our Contextual Agent Playbooks & Tools (CAPT), a unified framework that brings together deep organizational knowledge, safe access to internal systems, and executable engineering workflows. Today, CAPT powers AI-assisted development for more than 1,000 LinkedIn engineers and has fundamentally changed how we build, debug, analyze, and operate software at scale. In this blog, we'll share how we built CAPT, the engineering challenges we solved, the real-world impact it's having across teams, and the lessons we learned that can help other organizations bring AI agents into their development workflows. From vision to reality: Giving AI coding agents the context they need Modern AI coding assistants are remarkable. They can write code, explain architecture, generate tests, and even perform complex refactorings. But they all share a fundamental limitation. Without organizational context, AI coding agents hit a ceiling. For LinkedIn engineers, that organizational context is gained through lived experience and developing a comprehensive understanding of our tech stacks and developer environment, which includes: Thousands of microservices built over two decades Large-scale internal frameworks and libraries Petabyte-scale data infrastructure and analytics platforms Complex configuration management and multi-language service patterns Specialized observability, logging, and deployment systems New engineers take months to reach consistent levels of productivity in this environment, and even tenured engineers struggle outside their own domains. As we started experimenting with AI coding assistants, we noticed the same pattern. Engineers would use tools like GitHub Copilot for generic coding tasks (writing boilerplate, refactoring functions, generating tests), but the moment they needed to interact with LinkedIn-specific systems, the assistants struggled or couldn't help. They didn't know how to query our data platforms, navigate our experimentation framework, or follow our service creation patterns. More fundamentally, these agents lacked context beyond the current repository. They couldn't see code patterns from related services or understand how different parts of our system connected. Combined with their limited ability to interact with internal tools, many engineers remained hesitant to rely on agent support for real coding tasks, viewing them as helpful but not essential. This led us to a deliberate choice. Rather than build yet another coding assistant from scratch, we would augment existing AI agents. What they lacked wasn't intelligence. It was organizational context, access to internal tools, and structured guidance for LinkedIn-specific workflows. That insight became CAPT. A way to give off-the-shelf agents a deep understanding of LinkedIn. The core idea: Combine tools with executable knowledge A unified integration layer via MCP We built CAPT on the Model Context Protocol (MCP), an open standard for connecting AI agents to tools. Through MCP, CAPT provides agents with access to both LinkedIn's internal systems - like code search, data platforms, and observability tools - and third-party services for documents and tickets. Beyond individual tools, CAPT also exposes workflows implemented as playbooks that orchestrate multi-step tasks across these systems. This immediately unlocked compatibility with any MCP-aware coding agents, standardized interfaces for hundreds of tools, provided the ability to leverage community-built MCP tools, and made it easier to maintain integrations as agents evolve. Playbooks: Turning institutional knowledge into executable workflows MCP gave CAPT a stable foundation, but it was our playbooks that made CAPT powerful. Documentation tells you what to do . Playbooks tell AI agents how to do it - step-by-step. A playbook defines its purpose, inputs, file references, and a sequence of instructions written using Jinja2 templates. CAPT then exposes that playbook to agents as a tool rather than just a prompt template, so MCP-based agents can dynamically decide when to invoke it based on the problem at hand, chain it together with other tools, and reuse it compositionally across workflows, instead of relying on a single, static prompt. That is where things start to feel different. Tools are no longer just thin wrappers over APIs. They are encoded workflows. Example: Experiment cleanup LinkedIn runs thousands of A/B tests to optimize product features and user experiences across the platform. Once an experiment concludes and we've determined the winning variant, engineers need to clean up the experimental code by reviewing the experiment context and results, identifying all code paths tied to the experiment, removing the losing variants and stale flags, and validating that the winning behavior is now the default across all services\u2014a process that used to be manual and error-prone. This cleanup process was not only time-consuming but also required deep knowledge of LinkedIn's experimentation infrastructure. Engineers unfamiliar with the system often struggled or needed help from a small group of experts, creating bottlenecks. We captured that entire workflow in a single playbook that combines internal experimentation APIs, code search, and structured cleanup instructions. One engineer authored it. Suddenly, any engineer across any team could perform safe, consistent cleanup, even if they had never touched the experimentation stack before. The same pattern spread quickly. Need to create a new gRPC service? Add a new endpoint? Debug a crash? Run a deep, domain-specific data analysis? There\u2019s a playbook for that. Playbooks became reusable building blocks. Agents can call on them like functions. Knowledge that once lived only in senior engineers\u2019 heads is now encoded, validated, and executable. Engineering challenges and how we solved them Zero-friction distribution Even the most powerful developer tools fail if they're difficult to adopt. Complex installation processes, manual configuration steps, and dependency management issues create friction that prevents widespread use. We knew that for CAPT to succeed at LinkedIn's scale, engineers needed to be able to start using it immediately without wrestling with setup. We built CAPT as a Python package that works both as: A command line interface tool for configuration and authentication As a local MCP server that IDEs connect to automatically Using LinkedIn\u2019s internal developer tool distribution, CAPT ships to every laptop and updates silently in the background. Setup is as simple as: For external systems, engineers can either authenticate proactively with a one-time command or let CAPT handle it lazily. When a tool that requires those systems runs and authentication is missing, CAPT kicks off the OAuth flow and then stores the resulting credentials securely in the OS keychain. No JSON editing, no config wrangling, no dependency issues. Adoption grew quickly because onboarding required essentially zero effort. Scalable playbook management: Central + local As CAPT adoption grew, we faced a tension: some workflows apply across multiple repositories within the company, while others are specific to individual teams or services. A purely centralized approach would either force every team's playbook into a global repository (creating bloat and maintenance burden) or leave teams unable to encode their specialized workflows at all. CAPT supports two complementary categories of playbooks: Central playbooks are cross-cutting workflows that apply broadly across LinkedIn: experimentation cleanup, common debugging patterns, data analysis flows, PR review helpers, and observability workflows. These act as safe, validated defaults for the entire company. Local playbooks live directly in each repository and capture team- or service-specific workflows without bloating the global ecosystem. For example: When CAPT starts, it discovers both central and local playbooks and presents a unified surface to the agent. This model gave us a distributed contribution system. Any team can encode its workflows without waiting on a central platform team, while still benefiting from shared global playbooks. The result was less strain on central platform resources and faster developer velocity, as teams could ship new playbooks specific to their needs without going through lengthy review or integration processes. Scaling MCP to hundreds of tools As CAPT grew, exposing every internal service and playbook as an MCP tool quickly hit a practical limit. Most MCP clients work best with only a few dozen tools at a time. Our first approach was to group related tools into namespaces organized by workflow or use case. For example, the \"data\" namespace contained tools for data analysis, while the \"oncall\" namespace bundled together logs, metrics, and deployment tools for incident response. Engineers would load only the namespaces relevant to their current task, keeping the tool list manageable. While this helped initially, it still pushed complexity onto engineers, who had to know which namespaces to enable. Additionally, it broke down when workflows naturally crossed domains. An engineer working on a data analysis task might suddenly need to debug a pipeline failure, requiring them to manually switch to the oncall namespace mid-workflow. To fix this, we flipped the model. Instead of exposing every tool directly, the Capt MCP server now exposes a very small set of meta-tools that sit in front of thousands of underlying tools. These meta-tools let the LLM (not the user) discover tools by tag, inspect their schemas, and execute them (get_tools_for_tags, get_tool_info, exec_tool). Each underlying tool is tagged by function (e.g. experimentation, logs, metrics, deployments) and the LLM uses those tags to pick the right tool for a given prompt. Looking ahead, this design aligns well with emerging patterns like skills and advanced tool-calling from Anthropic, where agents search over large libraries of capabilities, load only the relevant ones on demand, and orchestrate them via code. As those ecosystems mature, we can swap or augment the implementation behind our meta-tools (for example, with richer tool search or programmatic tool calling) without changing how engineers write or use playbooks today. This design trades a few extra seconds of tool discovery for simplicity and scale. The main LLM no longer sees a giant list of tools on every request, which reduces context bloat and improves accuracy. Engineers no longer have to manage namespaces just to keep their agent usable, and we can grow to hundreds of tools without changing the MCP surface. Measuring impact through deep instrumentation Building CAPT was only half the challenge. Without concrete data on how engineers were actually using the platform, we would have no way to prioritize which playbooks to improve, identify workflows that weren't landing, or demonstrate value to leadership. Developer tools often struggle to justify their existence because impact is hard to quantify. We needed a way to move beyond anecdotes and gut feelings. So from day one, we instrumented every CAPT tool and playbook invocation. For each call we log when it happened, which repository it ran in, whether it succeeded, and which tool or playbook was used. Those signals power internal dashboards that answer simple but critical questions: Which playbooks are actually being used? Which teams rely on CAPT the most? Where does usage drop off? Which workflows are failing frequently and need better guardrails? That data shaped our roadmap. It also made it much easier to gain leadership support and secure continued investment in the platform, because we could show concrete impact rather than anecdotes. Real-world impact CAPT is not a research prototype. It runs in the middle of LinkedIn\u2019s engineering workflows, and each new integration unlocked a new class of use cases. Bringing code search into Copilot meant engineers could stay in the agent and still see the right code without jumping to other tools. Adding Trino turned natural language into real data analysis. Integrations with third-party services and wiki pages then let agents read rich context and write back findings, so workflows started to feel truly end-to-end. As the surface area grew, coding agents became markedly more useful, and adoption spread from early-adopter engineers to a much broader set of engineers. Data analysis for everyone Before CAPT, complex data analysis often required help from a data scientist or someone deeply familiar with our internal query engines and tooling. With CAPT, engineers, PMs, and EMs can start with a natural language question, have an agent translate it into the right queries against our data platforms, iterate based on results, and then turn those queries into reusable dashboards or lightweight data apps. A typical workflow now looks like a conversation: ask a question, inspect the results, refine the query, repeat. When the analysis stabilizes, the same agent can help convert it into a shareable artifact such as a dashboard or a simple app hosted on our internal data science platforms. The result is that analysis that used to take days of back-and-forth can now be done in hours. In many cases, teams report roughly 3\u00d7 faster time from question to usable insight, and they can get there themselves without needing deep expertise in our data tooling for each iteration. Automated customer issue debugging Customer issues used to require manually jumping between the issue tracker, logs, metrics, past incidents, and code. With CAPT, one of our playbooks orchestrates that workflow end to end. Given a ticket, the playbook reads the description, pulls relevant logs, classifies the type of issue, searches for similar incidents, identifies likely root causes, and points the engineer to the most relevant code paths. It then summarizes its findings back into the ticket so the next person who looks at it has immediate context. This doesn\u2019t replace human judgment, but it gives engineers a \u201cfirst pass\u201d investigation without having to manually jump between multiple systems. In practice, we\u2019ve seen initial triage time drop by around 70%. On-call incident response On-call incident response is stressful and time-sensitive. Engineers need to quickly gather information from multiple sources (e.g. metrics, logs, deployment history, past incidents) while under pressure to restore service. The cognitive load of remembering which dashboards to check, which queries to run, and how to correlate signals across systems makes incidents even more challenging. CAPT helps streamline this process by automating the initial investigation. On-call engineers now regularly paste an alert link into an agent and ask it to debug what\u2019s going on. Behind the scenes, the agent first selects an appropriate playbook for debugging the alert, and that playbook guides it through the investigation. Using CAPT\u2019s tools, the agent queries metrics, logs, deployment history, and incident records, looks for recent rollouts or related failures, and then surfaces a narrative: what changed, what is breaking, and where to look first. Instead of manually stitching together multiple dashboards and consoles, the on-call engineer gets a coherent starting point and a set of concrete next steps. AI-enhanced code review workflows CAPT also changed how code review works. Before code is even sent for human review, engineers can ask an agent to take a first pass. It checks for obvious correctness issues, validates patterns against internal best practices, suggests missing tests, and flags incomplete documentation or edge cases. That pre-review step catches many issues that would otherwise generate multiple review rounds. After review, another set of playbooks helps with the \u201clast mile\u201d of feedback resolution. Given a pull request with comments, an agent can propose concrete code changes to address the feedback, apply them, and push an updated commit, while still leaving the final approval to a human reviewer. Together, these patterns have led to higher-quality PRs and shorter review cycles, with engineers reporting they get back several hours a week that used to be spent on mechanical fixes and context setup. Automated debugging for data pipelines & ML training Data pipelines and ML training jobs are particularly painful to debug: failures can be intermittent, logs are often spread across systems, and the underlying infrastructure is complex. CAPT integrates with LinkedIn\u2019s compute stack so that, when a Spark job fails or an ML training run stalls, an agent can inspect logs, cluster metrics, job configurations, and historical runs in a coordinated way. It then suggests likely causes such as skew, bad input data, or resource constraints and points to the relevant configuration or code. For many teams, this has cut the time spent debugging failed jobs by more than half. Engineers who are not experts in our compute stack can still reason about issues and move forward, instead of waiting for a small set of specialists to become available. What we learned Building CAPT taught us lessons that, while specific to LinkedIn's infrastructure in their implementation, we believe apply broadly to any organization trying to integrate AI agents into their development workflows and can help avoid common pitfalls while focusing on what actually drives adoption and impact. Open standards matter. MCP gave us a common way to integrate with multiple agents and made it easy to adopt improvements in the broader ecosystem, without betting on a single client or vendor. Integrations compound. Every time we plugged CAPT into a core system starting with code search, then data platforms, then collaboration tools, the usage jumped and new workflows emerged, without changing the core architecture. Context is more valuable than raw intelligence. CAPT works not because it uses exotic models, but because it grounds mainstream models in the right tools, systems, and playbooks. Composability is a force multiplier . Small, focused playbooks combine into surprisingly sophisticated workflows when agents can chain them together like building blocks. Decentralization unlocks expert-driven playbooks. Domain experts turn their best practices into playbooks that anyone else can safely reuse. Starting with high-overhead, high-value workflows builds credibility. We focused early CAPT development on debugging, on-call support, and analysis; areas everyone knew were painful and time-consuming. So improvements there had outsized leverage and quickly created internal champions who pulled the platform into more and more areas. The future Even with its current impact, CAPT is still in the early stages of what it can become. One area we are actively exploring is richer, more dynamic tool selection. The meta-tool design opened the door to thousands of tools; the next step is making tool discovery even more adaptive to the engineer\u2019s context. The repository, the file being edited, the incident being worked on so that the agent feels less like a toolbox and more like a collaborator who gets where you are and what you\u2019re trying to do. We are also investing in automated playbook generation and maintenance. There is a clear opportunity to learn from how engineers use CAPT today. Which tools tend to be called together, which sequences repeat across teams and propose new playbooks or updates automatically. In the long run, we want CAPT to help maintain its own library of workflows instead of relying purely on manual curation. We also see an opportunity to reuse CAPT for background agents, not just interactive coding sessions. The same tools and playbooks that power an engineer\u2019s request in Github Copilot can also drive non-interactive workflows, batch jobs, recurring checks or maintenance tasks using the exact same building blocks. The bottom line Six months after launch, CAPT\u2019s impact is clear. More than 1,000 engineers use it. Issue triage time has dropped by about 70% in many areas. Data analysis is roughly three times faster for common workflows. Over 500 playbooks have been authored across the company, and developer satisfaction with the platform is consistently high. By wiring agents into the code, data, and document systems people already rely on, CAPT has also become a major driver of coding-agent adoption across engineering teams. The more important change, though, is cultural. CAPT has started to shift how engineers at LinkedIn work. Instead of teams reinventing the same workflows, they encode them once and make them available to everyone. Instead of AI assistants operating in a vacuum, they are grounded in our systems, patterns, and practices. By building on open standards like MCP and treating playbooks as executable, shareable knowledge, CAPT has become more than a collection of tools. It is a blueprint for how engineering organizations can bring AI into the heart of their development workflows safely, pragmatically, and at scale. Acknowledgement CAPT is the result of extensive collaboration across multiple LinkedIn teams. We are grateful for the leadership and guidance of Karthik Ramgopal , Prince , Satish Katiyar , and express our appreciation to (Alphabetical order): Ankit Babbar , Chetan Kulkarni , Dan Abbott , Daniel Kovachev , Deepika Aggarwal , Divya Manepalli , Hari Prasanna Periyasamy Shanmugam , Jonathan Yip , Kash Patel , Madeline Lee , Mathews Zacharia , Navaneeth Ranganna , Rachel Peterson , Richa Singh , Saicharan Komaravelli , Teddy Ni , Tony Xu , and Vidit Aggarwal",
+    "quality_score": 9,
+    "modules": [
+      "ai_assisted",
+      "dx",
+      "architecture_patterns"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/infrastructure/engineering-linkedins-job-ingestion-system-at-scale",
+    "title": "Engineering LinkedIn's job ingestion system at scale",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "Skip to main content\n\nInfrastructure\n\nEngineering LinkedIn's job ingestion system at scale\nAuthored by\nAnvesh Uppoora\n\nJanuary 29, 2026\n\nCo-authors: \nCo-authored by\nAnvesh Uppoora, \nCo-authored by\nRishav Kumar, and \nCo-authored by\nAvinash Permude\n\nRecruiting at scale requires seamless integration between LinkedIn and diverse job sources such as Applicant Tracking Systems (ATS), career sites, and job boards. Every day, LinkedIn processes millions of job postings from thousands of global sources, handling more than 20 terabytes of raw data. At the core of this effort is LinkedIn\u2019s job ingestion system\u2014a critical component that ensures an accurate, comprehensive, and timely job catalog from LinkedIn customers and partners. This enables employers to publish jobs seamlessly on LinkedIn and helps job seekers discover relevant opportunities faster. By connecting talent with opportunities at scale, members can transform their careers and livelihoods across the globe.\u00a0\n\n\nIn this blog, we\u2019ll explore the job ingestion workflow, from collecting diverse job data to transforming raw feeds into high-quality, enriched postings that meet LinkedIn\u2019s trust and quality standards.\n\nThe job ingestion ecosystem\n\nJob ingestion is the foundational process by which we collect, process, and publish external job data to LinkedIn. It enables both customers and partners to connect their source of truth of jobs with LinkedIn. Some of the challenges in building such a process include:\n\n\nSupport for heterogeneous feeds: Ingesting jobs from multiple sources and across multiple formats, such as career sites, XML, and JSON. This provides flexibility to companies, customers, and partners on how the jobs can be synced to LinkedIn from the source of truth.\nHandling diverse transport protocols: Ingesting using FTP, SFTP, HTTP/HTTPS, object store, etc. This provides flexibility in terms of how the data will be ingested to LinkedIn.\nImplementing robust security protocols: Supporting Basic Auth, Oauth 2, API Key, custom authentication to keep the platform safe and align with customers security practices.\nEnsuring data freshness: Ensuring the updates to the jobs in the feed are detected and reflected in LinkedIn as soon as possible.\nCustomization and enrichment: Providing options for customers to customize and enrich job attributes for management and promotions.\nMaintaining trust and quality: Ensuring the jobs meet a minimum quality and authenticity threshold before the final postings to safeguard the platform and maintain job seeker trust.\u00a0\nScalability: The system should be able to scale to ingest jobs from all segments.\u00a0\nPrinciples\u00a0\n\nTo handle the heterogeneity across sources, the ingestion system is architected to uphold three non-negotiable guarantees:\n\nReliability: Ensure jobs are processed accurately and quickly.\nScalability: Support billions of job updates annually.\nExtensibility: Easily onboard new sources and handle new job fields.\n\n\nAt its core, the job ingestion system is a modular, event-driven pipeline, built from a series of decoupled processing stages: Job Intake and Job Processing Pipeline.\n\nFigure 1. Job ingestion flow\nJob intake\n\nThe job intake step is a critical entry point in our job ingestion system, responsible for gathering job postings from thousands of external sources while maintaining compliance, integrity, and trust. It ensures a streamlined and efficient ingestion process before jobs are further processed, validated, and published on LinkedIn.\n\nMethods of job intake\n\nJob intake supports two main methods for gathering job data:\n\n\nJob push: Partners leverage LinkedIn's JobPostings API to efficiently create, update, and delete jobs in real time. This method is simple, involving just the execution of fundamental API validations prior to transmitting the job data downstream. Making API calls is effortless with LinkedIn's SDK support.\n\n\nJob pull: In this method, the job ingestion system periodically retrieves data from various sources (heterogeneous feeds) in different formats and posts them on LinkedIn. There are broadly two types of feeds:\n\nStructured feeds: This category includes data formatted in structured types such as XML and JSON. These feeds are easier to extract jobs from since the data is consistent, allowing us to simply enforce a schema or define a field mapping that can be used to derive the fields efficiently.\u00a0\nUnstructured feeds: These are sourced responsibly from publicly accessible career sites at the direction of the customer. These are much harder to pull and require using custom crawlers or constructing crawlable sitemaps that define the job field mappings and use them to extract the jobs.\u00a0\nJob pull deep dive\n\nLet\u2019s look at the more sophisticated job pull method in depth.\u00a0\n\n\nWhen you're pulling jobs from thousands of partners, the hardest problem is not just the volume, but also the variety. We needed to simultaneously ingest legacy SFTP servers serving static XML with Basic Auth, modern REST APIs using OAuth 2.0 tokens, and JavaScript-heavy career sites requiring headless browser automation etc. All while each combination demands different extraction logic, transport handling, and security protocols. The naive approach of building specialized pipelines for each combination would create an unmaintainable mess. We'd end up with N\u00d7M\u00d7K code paths (feed type \u00d7 transport \u00d7 auth scheme) that would fail every time we onboarded a new integration pattern. We needed an abstraction that made heterogeneity a configuration problem, not a code problem.\n\n\nTo achieve this, we created an orchestrator to be the brain of the system. It is a sophisticated load balancer that understands not just capacity, but capability. It maintains awareness of:\n\nWhich nodes specialize in structured feeds (XML/JSON) vs. unstructured (career sites)\nWhich nodes have access to secure networks for pulling data behind firewalls\nCurrent load across the mining fleet\n\n\nThe orchestrator delegates the incoming request to the right specialist (mining node) and tracks the work to completion.\n\n\nMining nodes are where the actual work happens. Each node is purpose-built for a specific extraction pattern:\n\nStructured feed miners handle XML/JSON feeds with schema-based extraction. They apply field mapping rules to transform partner formats into a standard schema.\nCareer site parsers execute headless browser automation to extract jobs from HTML. They navigate JavaScript-rendered content, handle pagination, and apply DOM selectors to locate job data.\nAPI integration miners manage REST endpoint interactions.\u00a0\nCustom protocol miners deal with legacy systems (FTP, SFTP) and proprietary partner integrations.\n\n\nBy separating orchestration from execution and specializing miners by domain, we achieved:\n\nFault isolation - A crash in career site parsing doesn't affect XML feed processing.\nIndependent scaling - We can add more career site miners without touching API miners\nSecurity zones - Different node types run in appropriate network contexts (public subnet, NAT-routed).\nExpertise optimization - Each miner implements best practices for its domain (e.g., browser pooling for unstructured feeds, connection reuse for API miners).\n\n\nWhile the distributed mining architecture scaled for runtime, we hit a wall with onboarding velocity. Every new integration required engineers to inspect sample feed data, write extraction rules (field mappings for XML/JSON, CSS selectors for career sites), test and deploy changes. The breakthrough was treating extraction logic (Sitemap) as configuration data instead of code, then building tooling for non-engineers to create it.\n\n\nFor structured feeds, we created an AI-powered config-based onboarding process, allowing any user to easily set up and create a Sitemap. A user uploads a sample job from the feed and the AI will analyze the structure and infer the field mappings. The user reviews/tweaks if needed. The Sitemap immediately goes live and the mining nodes will read it on the next run.\n\n\nFor unstructured feeds, we built an in-house browser plug-in for easier onboarding of new career sites. The user visits the career site and the extension guides him through selecting page elements (job title, description, location) and generates a Sitemap. It also allows users to test and verify.\n\n\nLessons learned: Configuration scales, code doesn't. Moving extraction logic to sitemaps removed the deployment bottleneck and significantly decreased the onboarding time for new sources.\n\n\nEnd to end flow\n\nBefore we dive into the entire flow, let\u2019s familiarize ourselves with some of the key components:\n\nJob source: A job source represents the origin from which job data is pulled into LinkedIn. This is our fundamental unit of configuration. Each feed, regardless of its acquisition method is modelled as a single job source enabling granular, source-specific configuration. Configurable parameters include custom job pull schedule, job count volatility configurations for sources with unstable job counts, source-specific job field processors for partners with unique data quirks, etc.\nSitemap: A sitemap defines the configurations for extracting job data from structured or unstructured feeds.\u00a0\nScheduler: Cron job that runs periodically and checks if there are job sources to schedule.\nNAT Gateway and subnets: Private-subnet nodes egress through a NAT gateway to present a static IP when partner feeds require allowlisting; public-subnet nodes use public IPs when static source IP is not required.\n\n\nFigure 2 illustrates the complete end\u2011to\u2011end flow. The steps are summarized below.\n\nSchedule: The scheduler initiates a job pull request to the mining task orchestrator, providing the list of job sources and source metadata (e.g., sitemap, securely retrieved credentials). The orchestrator creates a new mining task per source to track all jobs extracted in the run.\nPrepare and cache: The orchestrator persists task state/metadata in the distributed cache, evaluates feed characteristics, and determines the appropriate routing path (structured vs. unstructured).\nEnqueue by feed type: The orchestrator pushes schedule requests to the job pull queue, directing each source to either the structured or unstructured lane based on the feed type.\nAssign workers: Mining tasks are consumed by job\u2011mining nodes. The orchestrator balances assignments across nodes based on available capacity and feed requirements, allowing multiple sources to be processed in parallel.\nNetwork access policy: If a partner feed requires access from a specific static IP, the task is routed to a node in a private subnet that egresses via the NAT gateway; otherwise, nodes in public subnets access feeds using public IPs.\nExtract and push raw jobs: Mining nodes execute extraction for their assigned sources and push the resulting raw job messages into the jobs queue.\nNormalize and consume: The orchestrator consumes raw job messages from the jobs queue, normalizes them into a unified RawJob schema, and prepares them for downstream standardization\nPublish to downstream: Raw jobs are published to Kafka where further standardization takes place for platform-wide consumption and processing.\n\n\nWith this design each layer has one responsibility, and configuration (not code) defines how data flows.\n\nFigure 2. Mining tasks orchestrator and scheduler\nMining task\n\nWhen building a job ingestion platform at LinkedIn\u2019s scale, we faced a critical challenge: how do you coordinate the ingestion of millions of jobs without overwhelming downstream systems or losing track of what's in flight?\n\n\nOur solution centers on a state-machine approach using three simple message types: START, JOB, and END. When a job pull request arrives, we initiate a mining task that acts as a transactional boundary for the entire feed. Each individual job flows through as a JOB message containing its complete attribute set. The END message serves a dual purpose. On success, it carries metrics like total job count and completion time; on failure, it provides diagnostic context for debugging.\u00a0\n\n\nRather than processing jobs sequentially, we parallelize at the message level while maintaining task-level consistency. This architecture solves the \"hot partition\" problem where a single large source can't monopolize resources. Our mining task watcher tracks completion across parallel streams, then orchestrates the a multi-step finalization process that validates overall data quality, computes metrics and applies intelligent job lifecycle policies like suspending recently missing jobs (allowing for transient feed issues) while permanently removing jobs that have been absent beyond threshold, keeping LinkedIn's job marketplace fresh and accurate.\n\n\nThis design scales linearly with source count rather than job volume, allowing us to onboard new partners without capacity planning. More importantly, it gives us precise failure boundaries. We know exactly which source and which timestamp range needs retry.\n\nFigure 3. Mining task lifecycle\n\nWhile parallel processing prevented any single source from blocking others at the infrastructure level, we discovered a more subtle issue. A long-tail job board slowly publishing 500K listings would compete equally with a strategic partner's urgent update for 100 critical positions. In a first-come-first-served model, both mining tasks get equal priority once initiated but their business value differs by orders of magnitude.\n\n\nWe were treating all jobs equally after normalization, which meant high-value partners experienced unpredictable latency during system load and bulk historical imports from new integrations would starve real-time feeds. Solving hot partitions at the source level wasn't enough. We needed differentiation at the job level, based on business priority not just technical fairness.\n\n\nTo solve this, our architecture introduces a rank-based priority system at the normalization layer. Every incoming job regardless of source format gets transformed into our unified RawJob schema, then routed to one of several priority queues based on its source's business rank. This ensures that when a major recruiting platform pushes an update, it doesn't wait behind a long-tail source still processing a bulk feed. We treat queuing as a first-class resiliency concern. Each queue implements independent throttling, rate limiting, and circuit breakers protecting the entire pipeline from cascade failures. The key insight is to apply backpressure at the source level, not the system level.\n\n\nLessons learned: The temptation is to handle these concerns in processing. We learned that by the time a job reaches validation logic, it's too late; you've already consumed resources on low-priority work. Push prioritization and quality checks upstream.\n\nJob processing pipeline\n\nOnce a RawJob, regardless of the intake method, is consumed from the queue, it needs to undergo essential quality checks and customizations to ensure it meets standards before being published on LinkedIn. We faced another critical challenge here: each source sent us jobs in wildly different formats. Some had \"temp\" in titles but weren't marked as contract roles, others had ambiguous location data, and many were missing critical fields that our AI models downstream depended on. Having a monolithic pipeline couldn't scale.\u00a0\n\nJob field processors\n\nWe built our job processing architecture around a modular, configurable system called job field processors. Think of it as moving from a single assembly line to a flexible manufacturing system where we could add, remove, or reconfigure processing stations without stopping production.\n\nProcessor types\n\nThey are broadly classified into two main types:\u00a0\n\nStatic processors: Code-driven transformations that every job must undergo (e.g., standardizing location data, inferring employment type). These represent our core data quality guarantees.\nDynamic processors: Customer or source-specific rules created and managed via UI at runtime, without code deployments. This was the game-changer as our operations team could now respond to partner requests in hours instead of weeks.\nProcessing tiers\n\nThe processors are organized into three logical tiers:\n\n\nPre-processors: Pre-processors handle preliminary data preparation tasks, ensuring that the foundational fields required by downstream processors are complete and accurate. The focus here is on addressing raw data inconsistencies and filling missing gaps before deeper transformations begin. For instance,\u00a0\n\nSet job type to \u201ccontract\u201d if title contains \u201ctemp\u201d (via dynamic JFP).\nAssign a listed time to a job if it is empty or use a standard format if it\u2019s ambiguous.\n\n\nMid-processors: Mid-processors are responsible for performing core transformations and enrichment tasks. These processors rely on prior pre-processing steps and utilize advanced techniques, such as AI and machine learning models, to infer higher-order information and derive new data points. Examples:\n\nStandardize location data, using geocoding services to convert a simple address string into precise latitude and longitude.\nInfer the workplace type (on-site, hybrid, remote) based on job description and other signals.\n\n\nPost-processors: The post processors handle the final validations, deduplication, and cleanup before the raw job is persisted and is allowed to be published in LinkedIn. Example: Block jobs based on specific criteria, such as company, or country.\u00a0\n\n\nThese tiers ensure clean separation between data preparation, enrichment, and validation. To maintain consistency, JFPs are ranked numerically which influences the sequence of processor execution, making sure upstream dependencies are resolved before applying downstream rules. On an average a rawJob can go through 50 static and 350 Dynamic JFPs across the processing tiers in just 100ms. This is achieved through aggressive caching, fast-fail validations and more.\n\n\nThe most impactful decision was introducing dynamic JFPs using which we moved customization power from engineering to operations teams and eventually to customers themselves. With this we cut iteration time from weeks to hours and reduced engineering bottlenecks. Customers can also see why their jobs aren\u2019t publishing and take corrective actions using self service.\n\nMultiplexing\n\nMultiplexing is a step in the job ingestion pipeline that dynamically generates multiple derivative job postings from a single source job, based on predefined rules or schemas. For instance, in the case of location-based transformations, multiplexing enables the creation of separate job postings for each specified location.\u00a0\n\nPublisher\n\nAfter the raw job has successfully passed all processing and validation steps, a new job posting is published on LinkedIn, making it accessible for members to view and apply. While creating the job posting, all the eligible features determining the actions permissible for job postings (e.g., enabling job search or push recommendations) are added based on various criteria.\n\nConclusion\n\nBuilding a robust job ingestion system is more than a technical challenge, it\u2019s about creating a trusted, scalable platform that connects millions of professionals with the right opportunities. By supporting heterogeneous feeds, enforcing security, ensuring freshness, and maintaining quality, we can deliver value to employers and job seekers alike.\n\n\nThe lesson that transcends job ingestion is to invest early in platforms that shift control to users. The upfront cost may be higher, but the long-term leverage will be exponential.\n\n\nAs hiring needs evolve, we\u2019ll continue to innovate on scalability, customization, and intelligent enrichment, ensuring LinkedIn remains the most safe, trusted and reliable destination for talent and opportunity.\n\nTopics: Architecture Scalability Hiring\n\nRelated articles\n\nTalent\n\nDriving data enhancement & recruitment success with LinkedIn\u2019s...\n\nAditya Hegde \n\n \n\nMar 10, 2026\n\nInfrastructure\n\nSecuring every Kubernetes workload at scale\n\nRahul Godha \n\n \n\nFeb 26, 2026\n\nInfrastructure\n\nScaling maintenance: Rethinking HDFS block placement for exaby...\n\nPonmani Palanisamy \n\n \n\nJan 22, 2026",
+    "quality_score": 9,
+    "modules": [
+      "architecture_patterns",
+      "api_design",
+      "error_resilience"
+    ]
+  },
+  {
+    "url": "https://www.linkedin.com/blog/engineering/ai/scaling-llm-based-ranking-systems-with-sglang-at-linkedin",
+    "title": "Scaling LLM-Based ranking systems with SGLang at LinkedIn",
+    "source_name": "LinkedIn Engineering Blog",
+    "text": "At LinkedIn, we've been leveraging large language models (LLMs) to transform the search experience, launching AI Job Search and AI-powered People Search in the last year, and more broadly reimagining LinkedIn\u2019s search stack . Across these experiences, we evaluate every member query and rank hundreds of items by jointly reasoning over the query, the member\u2019s profile, and job or profile content. Behind the scenes, this kind of ranking workload is very different from what most people associate with LLMs, like chatbots or text generation. Instead of generating long responses token by token, ranking models simply score many options against the same query and return the best matches. In LLM terms, this means we only need the initial understanding step of the model\u2014called the prefill\u2014and none of the text generation that follows. We refer to this as prefill-only ranking: using LLMs to understand and score content, not to write text. In this blog, we dive into how we adapted and extended SGLang, an open-source LLM serving system, contributing key improvements to support prefill-only ranking at production scale. It\u2019s a journey that starts with obvious wins like batching, and gradually dives deep into LLM internals, GPU execution, and Python runtime behavior\u2014until the system finally behaves the way this workload demands. This work draws from our recent research on serving ranking workloads ( arXiv:2510.22101 , arXiv:2512.07846 ), and focuses on the engineering path from research to production. Why prefill-only ranking is different Prefill-only ranking has a set of properties that fundamentally distinguish it from generative LLM workloads: No decoding: The model processes the entire prompt once and returns only the final token\u2019s logits. There is no iterative token generation, no sampling, and no beam search. Long shared prefix: All prompts for a given query share a common prefix: system instructions, query text, and member context. Only the item-specific suffix differs. High concurrency: A single query may score hundreds or thousands of items. Strict latency SLAs: End-to-end P99 latency must stay within a few hundred milliseconds under load. Code paths optimized for text generation, sampling, or interactive, low-concurrency workloads add unnecessary overhead in this setting. With this understanding, we started our optimization journey\u2014intentionally, and in stages. Figure 1: Text generation vs prefill-only ranking Stage one: If it can batch, it should As a first step, we examined our serving stack end to end to understand where batching already existed\u2014and where it was missing. Given that ranking inherently involves scoring many items for the same query, we expected batching to be pervasive. In practice, however, we found several places where requests were still being processed serially, especially on the CPU side. Batch tokenization Our investigation began at the most fundamental layer: tokenization. Even when a ranking request arrived with many prompts, tokenization was performed sequentially one prompt at a time. For large inputs\u2014say, ~2k tokens across 100 items\u2014this alone could consume hundreds of milliseconds before the GPU ever became involved. This was our first \u201caha\u201d moment: CPU-side serialization can erase GPU gains before inference even starts. Our initial fix was enabling in-request batch tokenization ( PR #5141 ), allowing all prompts within a single request to be tokenized together using fast tokenizer batch APIs and parallel CPU execution. Figure 2: Throughput\u2013latency impact of dynamic batch tokenization for an Embedding-0.6B model (500-token inputs, H100 GPU, Poisson traffic distribution). While ranking requests often arrive with many items per query, other prefill-only workloads\u2014most notably embeddings\u2014tend to send a steady stream of single-prompt requests that are difficult to batch at the source. This motivated our next leap \u2014 implementing an Async Dynamic Batch Tokenizer ( PR #9382 ), which dynamically aggregates concurrently arriving single-prompt requests using asyncio and tokenizes them in a batch with a ThreadPoolExecutor . The mechanism uses configurable batch-size and timeout thresholds to balance latency and throughput, while keeping the async event loop responsive. Without any client-side changes, we achieved dramatic performance wins: as shown in Figure 2, for Embedding\u20110.6B model with 500-token inputs at QPS 500, P99 latency dropped from 4583 ms to 464 ms \u2014 roughly 10\u00d7 faster. Preserving batch boundaries: \u201cBatch send\u201d By this point, we expected batching to \u201cjust work.\u201d If a request contained, say, 50 prompts\u2014and the total token count was well within a single prefill threshold\u2014then all prompts should be executed in one GPU forward pass. However, this wasn\u2019t the case. Logs consistently showed multiple prefill batches for what should have been a single batch (as shown in Figure 3), and profiling confirmed the same behavior (Figure 4). Figure 3: Logs showing split prefill batches even when the total token count fits within one forward pass. Digging deeper, we found the root cause: although prompts were tokenized as a batch, the tokenizer manager transmitted them individually over the ZMQ socket. By the time requests reached the scheduler, the original batch structure was lost, leading to fragmented execution (e.g., 12 + 38) and unnecessary extra forward passes\u2014even when max-prefill-tokens were configured correctly. Figure 4: PyTorch profiler trace highlighting multiple prefill batch executions for a single request. We fixed this by introducing an explicit \u201cbatch send\u201d mechanism ( PR #9436 ), transmitting the entire tokenized batch as a single ZMQ message. This allowed the scheduler to see the full batch and execute it in a single GPU prefill pass. For a 0.6B model with 300-token inputs and a batch size of 50, this change reduced average latency from 70.39 ms to 41.12 ms per request\u2014a 41.5% reduction, purely by preserving batch integrity. Stage two: The case for a scoring-only fast path Batching delivered meaningful gains, but profiling quickly showed that a significant amount of time was still being spent on work that ranking simply doesn\u2019t need. Large parts of the inference path were optimized for generative workloads, not for prefill-only ranking, and this unnecessary overhead became the starting point for our second optimization stage. At this point, we also recognized that scoring deserved a first-class execution path rather than being treated as a special case of generation. This led us to introduce a dedicated scoring API in SGLang ( PR #6460 ), which provided a clean abstraction for ranking workloads and served as the foundation for the optimizations that followed. Scoring-optimized execution path The first breakthrough came from questioning the default path: why run a full decode/sampling loop when ranking only needs one forward pass through the prompt, returning the final token's logits? In prefill-only ranking, there is no autoregressive generation. The model processes the prompt once and returns a relevance signal derived from the final token\u2019s logits. However, the default execution path still entered the full decode and sampling loop, adding unnecessary CPU work and memory traffic. We introduced a scoring-optimized execution path in SGLang that runs identical prefill computation to generation, preserving accuracy, while skipping all token sampling, decode loops, and KV cache updates. This execution path extracts only the final token\u2019s logits required for relevance scoring and maintains exact semantic equivalence with the standard generation path. Reducing CPU/GPU synchronization and memory overhead Even after skipping decode, profiling showed the GPU frequently stalling on CPU-side overhead\u2014driven by unnecessary per-token logprob extraction, fragmented GPU\u2192CPU memory copies, and synchronization points that delayed kernel launches. To address this, we tightened the CPU\u2013GPU interaction by skipping per-token log-probability extraction entirely when it was not needed, replacing many small memory copies with a single vectorized gather, and overlapping CPU post-processing with GPU execution wherever possible. Figure 5: PyTorch profiler trace illustrating the benefit of a scoring-only fast path. On the left, the generative execution path introduces CPU\u2013GPU synchronization and memory overhead, causing GPU idle gaps. On the right, the scoring-optimized path removes these overheads, enabling near-continuous kernel launches and improving scoring efficiency These changes were upstreamed to SGLang ( PR #8840 , PR #9748 ) and had a dramatic effect. GPU profiling showed near-continuous kernel execution with synchronization gaps largely eliminated, as illustrated in Figure 5. This translated directly into end-to-end gains: On a 0.6B model with 300-token inputs at 100 QPS, P99 latency dropped from 6220 ms to 454 ms (13.7\u00d7) , while throughput increased by ~25% (Figure 6). By the end of this stage, the scoring path was lean and purpose-built: no decode, no unnecessary CPU work, and minimal CPU\u2013GPU synchronization overhead. Figure 6: Latency and throughput comparison before and after scoring-path optimizations on a 0.6B model with 300-token inputs at 100 QPS. P99 latency drops from 6220 ms to 454 ms (13.7\u00d7 improvement) while throughput increases by ~25%, highlighting the performance gains from GPU kernel optimization and reduced CPU\u2013GPU overhead Stage three: Reusing query work with in-batch prefix caching With decode removed and CPU\u2013GPU coordination tightened, we next focused on eliminating redundant work in the scoring path: recomputing the same query-prefix KVs for every item. In ranking workloads, all candidates share an identical query prefix, so repeatedly prefilling it and regenerating its KVs quickly dominates cost as batch sizes grow. Each item prompt differs only in its suffix, yet the query KVs were being recomputed every time. This led us to focus on query KV reuse, with two complementary approaches: Multi-Item Scoring (MIS) , which concatenates all items into a single sequence and relies on item-aware attention masking. This approach was covered in our earlier post, Turbocharging LinkedIn\u2019s Recommendation Systems with SGLang , and upstreamed to SGLang via PR #10979 . In-batch prefix caching , which preserves standard batched inputs while reusing query-prefix KV within a single forward pass. Both amortize prefix work; here we focus on in-batch prefix caching. In-batch prefix caching: Reusing query work inside a single forward pass SGLang\u2019s existing prefix cache avoids recomputation across requests but requires two forward passes\u2014one to populate the cache and another to score items. For large ranking batches, this extra pass limits throughput. In-batch prefix caching removes that overhead by reusing query-prefix KV within a single forward pass. How it works We compute the prefix KV once using the first prompt in the batch, then intercept the forward pass between KV computation and attention so the remaining items can reuse that KV directly, as illustrated in Figure 7. Consider a batch with two prompts: Prompt A: [1, 2, 3, 4, 5] Prompt B: [1, 2, 6, 7, 8] The shared prefix [1, 2] produces identical hidden states and KV values. Instead of recomputing them for Prompt B, we reuse the prefix KV from Prompt A, eliminating redundant work. Attention merging Each item\u2019s suffix tokens still need correct attention behavior. We compute attention as a merge of: Prefix attention : suffix tokens attend to the shared prefix KV. Suffix attention : suffix tokens attend to themselves via standard causal attention. The two attention results are combined using log-sum-exp, ensuring numerical correctness and unchanged scoring semantics. Figure 7: Illustration of in-batch prefix caching. The query prefix KV is computed once from the first prompt and reused for subsequent prompts in the same batch, eliminating redundant computation and reducing forward-pass cost. By moving KV reuse directly into the attention computation, in-batch prefix caching removes redundant prefix work entirely\u2014without changing model behavior or request structure. Comparison with Multi-Item Scoring In practice, in-batch prefix caching and Multi-Item Scoring (MIS) deliver similar amortization for our production workloads. On a pruned 0.4B model with ~60 query tokens and ~145 item tokens, we observe comparable throughput: Approach Throughput (items/s) Multi-Item Scoring ~2100 In-Batch Prefix Caching ~2200 The key difference is where the optimization lives. As shown in Figure 8, MIS pushes item separation and masking deep into optimized attention kernels that causes tighter coupling with the kernel implementations. In contrast, in-batch prefix caching operates at a higher level in the execution stack. It preserves standard batched inputs, avoids concatenation, and does not require specialized kernel-level masking. Figure 8: Comparison of attention computation for Token 8 in Item 2 between in-batch prefix caching and Multi-Item Scoring (MIS). In-batch prefix caching operates at a higher level, preserving standard batched inputs and reusing query-prefix KV. MIS, in contrast, operates with optimized kernels using item-aware masking. Stage four: And then\u2026 Python At LinkedIn, SGLang runs behind a Python-based gRPC server that handles request parsing, access validation, and observability (metrics, logging, and tracing). By this point, the GPU execution path was lean: no decode, minimal synchronization, reused KV, and well-coalesced batches. Profiling showed the next bottlenecks were no longer in CUDA kernels\u2014but in Python runtime behavior around the engine. Two issues stood out: periodic garbage collection stalls and Global Interpreter Lock (GIL) contention in the Python gRPC serving layer. Eliminating GC stalls Under sustained load, Python\u2019s generational garbage collector occasionally scanned large numbers of long-lived objects, causing 100\u2013300 ms pauses every few seconds. Even infrequent stalls like these are unacceptable when targeting sub-500 ms P99 latency. We addressed this by warming the server so that long-lived objects are fully initialized before serving traffic, freezing the heap using Python\u2019s gc.freeze() to exclude those objects from future garbage-collection scans, and adding operational hooks that allow the garbage collector to be safely frozen and unfrozen at runtime. Together, these changes ( PR#9241 ) eliminated periodic latency spikes without affecting correctness or long-running stability, restoring predictable tail latency under sustained load. Escaping the GIL with multi-process gRPC Even after stabilizing GC behavior, the Python gRPC layer remained a throughput bottleneck. Request handling, deserialization, and preprocessing all contend for the GIL, effectively serializing work on a single CPU core per process. To remove this bottleneck, we introduced a multi-process serving architecture in which multiple gRPC servicer processes handle network I/O and request preprocessing, while dedicated SGLang engine processes execute inference. Requests are passed between processes using efficient inter-process communication via ZMQ. When the scheduler became the bottleneck: Multi-Process SGLang scheduling Removing gRPC-side GIL contention exposed the next limit in the system. For some deployments\u2014especially those using aggressive context compression techniques ( like MixLM ), input lengths became short enough that GPU prefill completed very quickly, shifting the bottleneck from GPU execution to CPU-side scheduling inside SGLang. At high request rates, a single scheduler process became CPU-bound, limiting how quickly batches could be prepared and dispatched despite available GPU capacity. We addressed this by introducing multi-process scheduler parallelization: Run multiple SGLang scheduler processes per GPU (e.g., 2 workers) Partition GPU memory across schedulers (e.g., ~50% per worker) Together, the gRPC servicer decoupling and scheduler parallelization allowed CPU-side work to scale with available cores while keeping the GPU fully utilized through pipelined batch preparation and execution (Figure 9). In production benchmarks, this delivered an additional ~40% throughput increase beyond what a single Python process could sustain. Figure 9: High-level overview of the gRPC servicer and SGLang worker process setup in our inference server. Conclusion: Lessons from a production optimization journey Before we wrap up, here\u2019s a quick look at what these optimizations bought us in production: Workload Model Input Structure Query / Item Tokens Throughput (items/s/GPU) Gain Reference Text-based ranking 375M decoder-only ranker Query + item text Query: 50 Item: 150 Batch size: 50 750 -> 2,200 ~3x arXiv:2510.22101 Mixed-input (embedding-based) ranking 0.6B decoder-only ranker Query text + item embeddings Query: 60 tokens Item: 1 embedding + 1 special token Batch size: 50 10k -> 22k ~2.2x arXiv:2512.07846 All results are measured on H100 GPUs under a p99 latency \u2264 500 ms, and reflect the cumulative effect of batching, scoring-only execution, shared-prefix amortization, and runtime/multiprocessing optimizations. Profile, analyze, then optimize for the workload The biggest takeaway from this effort is deceptively simple: Optimization is only as good as how well you profile and understand the workload characteristics . For prefill-only ranking, that meant focusing relentlessly on the true critical path\u2014and recognizing that CPU wins amplify GPU wins. Once the GPU execution path was efficient, CPU coordination and runtime behavior became the dominant factors shaping end-to-end latency. Optimization is a marathon, not a sprint This wasn\u2019t one silver bullet. The gains came in stages: batching, scoring-only execution, KV reuse in attention, shared-prefix amortization, and finally removing Python runtime bottlenecks via multiprocessing. Each optimization exposed the next ceiling. That\u2019s the reality of LLM inference at scale\u2014it\u2019s a marathon. While these changes delivered major wins, the journey continues. We\u2019re now going deeper into the stack with fine-grained profiling , kernel-level tuning, and further trimming overheads in prefill and attention paths. Specialization without divergence A natural question is whether a dedicated scoring path risks diverging from the main inference engine. Our answer is no. While the ranking API is specialized, execution is treated as a prefill-only workload inside SGLang\u2014not a fork\u2014removing only what ranking doesn\u2019t need while inheriting everything that still matters for performance and correctness. Impact at scale\u2014and beyond At LinkedIn, these advancements power AI Job Search and AI People Search to deliver state-of-the-art LLM ranking to millions of members. Beyond LinkedIn, we are committed to making prefill-only ranking a first-class citizen in the open-source ecosystem. We\u2019ve moved the needle in SGLang, and we\u2019re just getting started. Want to join us? Check out the SGLang Prefill-Only Roadmap and contribute here .",
+    "quality_score": 9,
+    "modules": [
+      "ai_assisted",
+      "performance",
+      "concurrency"
+    ]
   }
 ]

```

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | Looking at these commits, "concurrency" isn't actually the through-line — the real story is what this engineer built: a content intelligence system that was producing zero posts, and the systematic wo | needs_human | | |
| 1 | The ADR doc named it plainly. | needs_human | | |
| 2 | The module taxonomy was too narrow — no "general engineering" detection, so the system returned nothing. | needs_human | | |
| 3 | Events state lived outside Supabase, burning API calls on every run. | needs_human | | |
| 4 | No in-memory SHA dedup meant the same commit could get enriched N times per run. | needs_human | | |
| 5 | But fixing detection logic alone isn't enough if your extraction layer is fragile. | needs_human | | |
| 6 | So Puppeteer fallback got hardened behind a config-driven host list — discord.com, stripe.com, others — with match strength tracking baked into the DB schema. | needs_human | | |
| 7 | Protected sources got their own handling path. | needs_human | | |
| 8 | The extraction pipeline now knows the difference between "couldn't fetch" and "fetched but weak." | needs_human | | |
| 9 | Then came the corpus work. | needs_human | | |
| 10 | Seventy-five-plus curated articles seeded by hand, each with topic tags, quality scores, author attribution, and editorial notes explaining *why* they're worth surfacing — not just that they are. | needs_human | | |
| 11 | Concurrency in Elixir, causal ordering failures in Remix, free-threaded Python, Go pipeline design at Cloudflare, trace propagation across Elixir message passing without blowing up telemetry costs. | needs_human | | |
| 12 | The corpus isn't random. | needs_human | | |
| 13 | It's the ground truth the system learns signal from. | needs_human | | |
| 14 | Phase 3 swapped compressed Haiku extraction for statistical voice-moves measurement with stage-based example selection. | needs_human | | |
| 15 | A probabilistic dice mechanism controls when generation context gets injected. | needs_human | | |
| 16 | This is what a system going from "produces ~0 posts" to actually working looks like. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
