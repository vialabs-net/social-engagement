# Post 001

## Post generado

> The system was producing ~0 posts. Not "fewer than expected" — zero. Three bugs were compounding each other into silence.
> 
> First: the detection modules were too narrow. Without a general engineering category, valid commits fell through every filter. Second: events_state wasn't persisted to Supabase, so every run re-fetched API data it had already seen. Third: no in-memory SHA deduplication meant the same commit could be enriched multiple times in a single run.
> 
> Any one of these would degrade output. All three together meant the system burned API budget, re-processed the same work, and still produced nothing users could read.
> 
> The fix surfaces all three in the same ADR batch — nine architecture decision records written together, alongside a consolidated 3,400-line v1.5.17 master spec. That's a meaningful choice: treating three separate failure modes as a single architectural moment rather than three independent patches. The dedup fix is a Set<string> in memory. The state persistence is two methods added to SupabaseStorage. The module expansion is a threshold change plus a new category. Each one is small. Naming them together is what makes the system legible to the next person who has to debug it.
> 
> The seed corpus work running in parallel — 100+ curated articles across Go generics, Python JIT, React governance, Quarkus LTS, concurrency scheduling — is the other half of that legibility story. A content system needs reference material that reflects real engineering decisions, not just popular posts. Container-aware GOMAXPROCS latency implications and CPython JIT tradeoffs aren't filler; they're the calibration layer.
> 
> Silence is a hard failure mode to catch because it looks like "not ready yet." These commits made it diagnosable.
> 
> #lilicurl #codingWithHumor

## Commits de origen

### Commit 1: 5e6df49
**Message:** feat: expand seed corpus with concurrency and governance batch

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index 406ed2f..433bdf3 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -129,3 +129,9 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 128,track2,java_patterns,"error_resilience,devops",https://quarkus.io/blog/quarkus-3-32-released/,"Quarkus 3.32 - Project Leyden integration, more graceful shutdown, automatic Consul registration and more!","Quarkus Blog","Guillaume Smet",2026-02-26,8,"A useful resilience-and-operations article that ties graceful shutdown behavior, service registration, and security extension work to concrete runtime outcomes for Java services.",kept,,
 129,track2,dependency_health,"error_resilience,devops",https://github.blog/news-insights/product-news/whats-coming-to-our-github-actions-2026-security-roadmap/,"What’s coming to our GitHub Actions 2026 security roadmap","The GitHub Blog","Greg Ose",2026-03-26,8,"A practical CI/CD security article on hardening Actions with secure defaults, policy controls, and observability to reduce supply-chain blast radius in real pipelines.",kept,,
 130,track2,go_patterns,"evolutionary,dependency_health",https://go.dev/blog/toolchain,"Forward Compatibility and Toolchain Management in Go 1.21","The Go Blog","Russ Cox",2023-08-14,8,"A high-signal Go article on making toolchain selection part of the language workflow, which is useful both for language evolution and for keeping dependency and build compatibility predictable.",kept,,
+131,track2,concurrency,"error_resilience,devops",https://go.dev/blog/container-aware-gomaxprocs,"Container-aware GOMAXPROCS","The Go Blog","Michael Pratt; Carlos Amedee",2025-08-20,9,"A strong concurrency and operations article on goroutine scheduling under CPU limits, with concrete Kubernetes latency implications and safer production defaults.",kept,,
+132,track2,python_patterns,"performance,evolutionary",https://blog.python.org/2026/03/jit-on-track/,"Python 3.15's JIT is now back on track","Python Insider","Ken Jin",2026-03-23,8,"A high-signal runtime article on how CPython's JIT regained momentum, mixing performance data with concrete engineering tradeoffs in compiler and interpreter design.",kept,,
+133,track2,python_patterns,"dependency_health,evolutionary",https://blog.python.org/2025/04/python-3140a7-3133-31210-31112-31017/,"Python 3.14.0a7, 3.13.3, 3.12.10, 3.11.12, 3.10.17 and 3.9.22 are now available","Python Insider","Hugo van Kemenade",2025-04-08,8,"A strong Python release post that bundles runtime evolution, version-line maintenance, and security-minded upgrade signals across several supported branches in one detailed update.",kept,,
+134,track2,dependency_health,"security,python_patterns",https://blog.python.org/2026/03/python-31213-31115-31020/,"Python 3.12.13, 3.11.15 and 3.10.20 are now available!","Python Insider","Thomas Wouters",2026-03-03,8,"A practical security-release post with concrete remediation details across supported Python lines, useful for dependency hygiene and upgrade decision-making.",kept,,
+135,track2,java_patterns,"dependency_health,devops",https://quarkus.io/blog/quarkus-3-33-released/,"Quarkus 3.33 LTS - new LTS version","Quarkus Blog","Guillaume Smet",2026-03-25,8,"A solid platform article on the new Quarkus LTS, migration guides, and component upgrades that matter for long-lived Java services and upgrade planning.",kept,,
+136,track2,react_patterns,"evolutionary,design_patterns",https://react.dev/blog/2026/02/24/the-react-foundation,"The React Foundation: A New Home for React Hosted by the Linux Foundation","React Blog","Matt Carroll",2026-02-24,8,"A useful ecosystem-governance article because it explains how React is evolving its stewardship and technical governance without tying the project to a single company.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index 90b7bc4..bc8ed27 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -1486,18 +1486,6 @@
       "security"
     ]
   },
-  {
-    "url": "https://blog.python.org/2026/04/rust-for-cpython-2026-04/",
-    "title": "Rust for CPython Progress Update April 2026",
-    "source_name": "Python Insider",
-    "text": "This post has also been shared on discuss.python.org . We (the Rust for CPython community) wanted to provide an update on where the project is and our current plans from now to a Python Enhancement Proposal (PEP) for introducing Rust into CPython. Recent work Since the pre-PEP thread , we’ve been working on making the reference implementation build system more robust across the platforms CPython supports. We’re now successfully building CPython with Rust in our fork’s CI on all tested platforms. We’ve also had a number of productive discussions with the Rust team, who have been incredibly generous to meet with us to discuss the needs of the CPython project and how best to address issues we face with integrating Rust with CPython. I’m incredibly grateful to everyone who has joined those meetings. We’ve also had some discussions about the design of a Rust API for CPython. You can see issues tagged api-design which cover the critical components of the API design. We’d love to get more input on designing the Rust API, so please see below about contributing if you are interested in working with us on the Rust API. As a reminder, this API will remain internal until a later PEP stabilizes it and makes it public. Roadmap to a PEP Since the pre-PEP, we’ve decided that we will be targeting Python 3.16 rather than 3.15 as the first Python version to include Rust code. This gives us a year to make the reference implementation the best it can be and plenty of time for discussion of the PEP. The below timeline is subject to change, but covers a rough plan of what and when we hope to accomplish things: March Done! Finish the build system work, ensuring platforms tested in CPython CI are green April Start planning the internal Rust API design Select a single extension module to have a Rust implementation in 3.16 May Finalize a plan for the internal Rust API design Start implementing the internal Rust API Sprint at PyConUS on the internal Rust API and the extension module June Start writing the PEP July Finalize the PEP draft Submit the PEP and begin discussion We recognize introducing Rust is a significant change, and expect the PEP discussion to be lengthy, so we want to make sure there is ample time to discuss it prior to 3.16 beta 1 in May 2027 . Contributing Interested in contributing to the Rust for CPython project? Please join our Discord ! We have meetings every Monday at 12:00PM PDT to discuss the project. We’d love to have more folks join those meetings and work with us on Rust for CPython!",
-    "quality_score": 8,
-    "modules": [
-      "python_patterns",
-      "evolutionary",
-      "complexity"
-    ]
-  },
   {
     "url": "https://blog.python.org/2026/04/python-3150a8-3144-31313/",
     "title": "Python 3.15.0a8, 3.14.4 and 3.13.13 are out!",
@@ -1557,5 +1545,89 @@
       "dependency_health",
       "performance"
     ]
+  },
+  {
+    "url": "https://go.dev/blog/container-aware-gomaxprocs",
+    "title": "Container-aware GOMAXPROCS",
+    "source_name": "The Go Blog",
+    "text": "Go 1.25 includes new container-aware GOMAXPROCS defaults, providing more sensible default behavior for many container workloads, avoiding throttling that can impact tail latency, and improving Go’s out-of-the-box production-readiness. In this post, we will dive into how Go schedules goroutines, how that scheduling interacts with container-level CPU controls, and how Go can perform better with awareness of container CPU controls. GOMAXPROCS One of Go’s strengths is its built-in and easy-to-use concurrency via goroutines. From a semantic perspective, goroutines appear very similar to operating system threads, enabling us to write simple, blocking code. On the other hand, goroutines are more lightweight than operating system threads, making it much cheaper to create and destroy them on the fly. While a Go implementation could map each goroutine to a dedicated operating system thread, Go keeps goroutines lightweight with a runtime scheduler that makes threads fungible. Any Go-managed thread can run any goroutine, so creating a new goroutine doesn’t require creating a new thread, and waking a goroutine doesn’t necessarily require waking another thread. That said, along with a scheduler comes scheduling questions. For example, exactly how many threads should we use to run goroutines? If 1,000 goroutines are runnable, should we schedule them on 1,000 different threads? This is where GOMAXPROCS comes in. Semantically, GOMAXPROCS tells the Go runtime the “available parallelism” that Go should use. In more concrete terms, GOMAXPROCS is the maximum number of threads to use for running goroutines at once. So, if GOMAXPROCS=8 and there are 1,000 runnable goroutines, Go will use 8 threads to run 8 goroutines at a time. Often, goroutines run for a very short time and then block, at which point Go will switch to running another goroutine on that same thread. Go will also preempt goroutines that don’t block on their own, ensuring all goroutines get a chance to run. From Go 1.5 through Go 1.24, GOMAXPROCS defaulted to the total number of CPU cores on the machine. Note that in this post, “core” more precisely means “logical CPU.” For example, a machine with 4 physical CPUs with hyperthreading has 8 logical CPUs. This typically makes a good default for “available parallelism” because it naturally matches the available parallelism of the hardware. That is, if there are 8 cores and Go runs more than 8 threads at a time, the operating system will have to multiplex these threads onto the 8 cores, much like how Go multiplexes goroutines onto threads. This extra layer of scheduling is not always a problem, but it is unnecessary overhead. Container Orchestration Another of Go’s core strengths is the convenience of deploying applications via a container, and managing the number of cores Go uses is especially important when deploying an application within a container orchestration platform. Container orchestration platforms like Kubernetes take a set of machine resources and schedule containers within the available resources based on requested resources. Packing as many containers as possible within a cluster’s resources requires the platform to be able to predict the resource usage of each scheduled container. We want Go to adhere to the resource utilization constraints that the container orchestration platform sets. Let’s explore the effects of the GOMAXPROCS setting in the context of Kubernetes, as an example. Platforms like Kubernetes provide a mechanism to limit the resources consumed by a container. Kubernetes has the concept of CPU resource limits, which signal to the underlying operating system how many core resources a specific container or set of containers will be allocated. Setting a CPU limit translates to the creation of a Linux control group CPU bandwidth limit. Before Go 1.25, Go was unaware of CPU limits set by orchestration platforms. Instead, it would set GOMAXPROCS to the number of cores on the machine it was deployed to. If there was a CPU limit in place, the application may try to use far more CPU than allowed by the limit. To prevent an application from exceeding its limit, the Linux kernel will throttle the application. Throttling is a blunt mechanism for restricting containers that would otherwise exceed their CPU limit: it completely pauses application execution for the remainder of the throttling period. The throttling period is typically 100ms, so throttling can cause substantial tail latency impact compared to the softer scheduling multiplexing effects of a lower GOMAXPROCS setting. Even if the application never has much parallelism, tasks performed by the Go runtime—such as garbage collection—can still cause CPU spikes that trigger throttling. New default We want Go to provide efficient and reliable defaults when possible, so in Go 1.25, we have made GOMAXPROCS take into account its container environment by default. If a Go process is running inside a container with a CPU limit, GOMAXPROCS will default to the CPU limit if it is less than the core count. Container orchestration systems may adjust container CPU limits on the fly, so Go 1.25 will also periodically check the CPU limit and adjust GOMAXPROCS automatically if it changes. Both of these defaults only apply if GOMAXPROCS is otherwise unspecified. Setting the GOMAXPROCS environment variable or calling runtime.GOMAXPROCS continues to behave as before. The runtime.GOMAXPROCS documentation covers the details of the new behavior. Slightly different models Both GOMAXPROCS and a container CPU limit place a limit on the maximum amount of CPU the process can use, but their models are subtly different. GOMAXPROCS is a parallelism limit. If GOMAXPROCS=8 Go will never run more than 8 goroutines at a time. By contrast, CPU limits are a throughput limit. That is, they limit the total CPU time used in some period of wall time. The default period is 100ms. So an “8 CPU limit” is actually a limit of 800ms of CPU time every 100ms of wall time. This limit could be filled by running 8 threads continuously for the entire 100ms, which is equivalent to GOMAXPROCS=8 . On the other hand, the limit could also be filled by running 16 threads for 50ms each, with each thread being idle or blocked for the other 50ms. In other words, a CPU limit doesn’t limit the total number of CPUs the container can run on. It only limits total CPU time. Most applications have fairly consistent CPU usage across 100ms periods, so the new GOMAXPROCS default is a pretty good match to the CPU limit, and certainly better than the total core count! However, it is worth noting that particularly spiky workloads may see a latency increase from this change due to GOMAXPROCS preventing short-lived spikes of additional threads beyond the CPU limit average. In addition, since CPU limits are a throughput limit, they can have a fractional component (e.g., 2.5 CPU). On the other hand, GOMAXPROCS must be a positive integer. Thus, Go must round the limit to a valid GOMAXPROCS value. Go always rounds up to enable use of the full CPU limit. CPU Requests Go’s new GOMAXPROCS default is based on the container’s CPU limit, but container orchestration systems also provide a “CPU request” control. While the CPU limit specifies the maximum CPU a container may use, the CPU request specifies the minimum CPU guaranteed to be available to the container at all times. It is common to create containers with a CPU request but no CPU limit, as this allows containers to utilize machine CPU resources beyond the CPU request that would otherwise be idle due to lack of load from other containers. Unfortunately, this means that Go cannot set GOMAXPROCS based on the CPU request, which would prevent utilization of additional idle resources. Containers with a CPU request are still constrained when exceeding their request if the machine is busy. The weight-based constraint of exceeding requests is “softer” than the hard period-based throttling of CPU limits, but CPU spikes from high GOMAXPROCS can still have an adverse impact on application behavior. Should I set a CPU limit? We have learned about the problems caused by having GOMAXPROCS too high, and that setting a container CPU limit allows Go to automatically set an appropriate GOMAXPROCS , so an obvious next step is to wonder whether all containers should set a CPU limit. While that may be good advice to automatically get a reasonable GOMAXPROCS defaults, there are many other factors to consider when deciding whether to set a CPU limit, such as prioritizing utilization of idle resources by avoiding limits vs prioritizing predictable latency by setting limits. The worst behaviors from a mismatch between GOMAXPROCS and effective CPU limits occur when GOMAXPROCS is significantly higher than the effective CPU limit. For example, a small container receiving 2 CPUs running on a 128 core machine. These are the cases where it is most valuable to consider setting an explicit CPU limit, or, alternatively, explicitly setting GOMAXPROCS . Conclusion Go 1.25 provides more sensible default behavior for many container workloads by setting GOMAXPROCS based on container CPU limits. Doing so avoids throttling that can impact tail latency, improves efficiency, and generally tries to ensure Go is production-ready out-of-the-box. You can get the new defaults simply by setting the Go version to 1.25.0 or higher in your go.mod . Thanks to everyone in the community that contributed to the long discussions that made this a reality, and in particular to feedback from the maintainers of go.uber.org/automaxprocs from Uber, which has long provided similar behavior to its users.",
+    "quality_score": 9,
+    "modules": [
+      "concurrency",
+      "error_resilience",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://blog.python.org/2026/03/jit-on-track/",
+    "title": "Python 3.15's JIT is now back on track",
+    "source_name": "Python Insider",
+    "text": "This was originally posted on Ken Jin’s Blog . (JIT performance as of 17 March (PST). Lower is better versus interpreter. Image credits to doesjitgobrrr.com ). Great news---we’ve hit our (very modest) performance goals for the CPython JIT over a year early for macOS AArch64, and a few months early for x86_64 Linux. The 3.15 alpha JIT is about 11-12% faster on macOS AArch64 than the tail calling interpreter, and 5-6% faster than the standard interpreter on x86_64 Linux. These numbers are geometric means and are preliminary. The actual range is something like a 20% slowdown to over 100% speedup (ignoring the unpack_sequence microbenchmark). We don’t have proper free-threading support yet, but we’re aiming for that in 3.15/3.16. The JIT is now back on track. I cannot overstate how tough this was . There was a point where I was seriously wondering if the JIT project would ever produce meaningful speedups. To recap, the original CPython JIT had practically no speedups: 8 months ago I posted a JIT reflections article on how the original CPython JIT in 3.13 and 3.14 was often slower than the interpreter. That was also around the time where the Faster CPython team lost funding by its main sponsor. I’m a volunteer so this didn’t affect me, but more importantly it did affect my friends working there, and at a point of time it seemed the JIT’s future was uncertain. So what changed from 3.13 and 3.14? I’m not going to give some heroic tale of how we rescued the JIT from the jaws of failure through our acumen. I honestly attribute a lot of our current success to luck---right time, right place, right people, right bets. I seriously don’t think this would’ve been possible if a single one of the core JIT contributors: Savannah Ostrowski, Mark Shannon, Diego Russo, Brandt Bucher, and me were not in the picture. To not exclude the other active JIT contributors, I will also name a few more people: Hai Zhu, Zheaoli, Tomas Roun, Reiden Ong, Donghee Na, and I am probably missing a few more. I’m going to cover a lesser talked about part of a JIT: the people, and a bit of luck. If you want the technical details of how we did it, it’s here . The Faster CPython team lost its main sponsor in 2025. I immediately raised the idea of community stewardship . At the time, I was pretty uncertain this would work. JIT projects are not known to be good for new contributors. It historically requires a lot of prior expertise. At the CPython core sprint in Cambridge, the JIT core team met, and we wrote a plan for a 5% faster JIT by 3.15 and a 10% faster JIT by 3.16, with free-threading support. A side note, which was less headline grabbing, but vital to the health of the project: was to decrease the bus factor . We wanted 2 active maintainers in all 3 stages of the JIT; frontend (region selector), middle-end (optimizer), backend (code generator). Previously, the JIT only had 2 active recurrent contributors middle-end. Today, the JIT has 4 active recurrent contributors to the middle-end, and I would consider the 2 non-core developers (Hai Zhu and Reiden) capable and valued members. What worked in attracting people were the usual software engineering practices: breaking complex problems down into manageable parts. Brandt started this earlier in 3.14, where he opened multiple mega-issues that split optimizing the JIT into simple tasks. E.g. we would say “try optimizing a single instruction in the JIT”. I took Brandt’s idea and did this for 3.15. Luckily, I had an easier job as my issue involved converting the interpreter instructions to an easily optimizeable form. To encourage new contributors, I also laid out very detailed instructions that were immediately actionable. I also clearly demarcated units of work. I suspect that did help, as we have 11 contributors (including me) working on that issue, converting nearly the whole of the interpreter to something more JIT-optimizer friendly. The core was that the JIT could be broken down from an opaque blob to something that a C programmer with no JIT experience could contribute to. Other things that worked: encouraging people, celebrating achievements big or small. Every JIT PR had a clear outcome, which I suspect gave people a sense of direction. The community optimization efforts paid off. The JIT went from 1% faster on x86_64 Linux to 3-4% faster (see the blue line below) over that time period: (Image credits to doesjitgobrrr.com ). Part 2: Lucky bets Trace recording Again, I attribute a lot of this to luck, but during the CPython core sprints in Cambridge, Brandt nerd-sniped me to rewrite the JIT frontend to a tracing one. I initially didn’t like the idea, but as a friendly form of spite-driven-development, I thought I’d rewrite it just to prove to him it didn’t work. The initial prototype worked in 3 days, however it took a month to get it JITting properly without failing the test suite. The initial results were dismal---about 6% slower on x86_64 Linux. I was about to ditch the idea, until a lucky accident happened: I misinterpertered a suggestion given by Mark. Mark had suggested earlier to thread the dispatch table through the interpreter, thus having two dispatch tables in the interpreter (one normal interpreter, and one for tracing). Mark suggested we should have the tracing table be tracing versions of normal instructions. However, I misunderstood and came up with an even more extreme version: instead of tracing versions of normal instructions, I had only one instruction responsible for tracing, and all instructions in the second table point to that. Yes I know this part is confusing, I’ll hopefully try to explain better one day. This turned out to be a really really good choice. I found that the initial dual table approach was so much slower due to a doubling of the size of the interpreter, causing huge compiled code bloat, and naturally a slowdown. By using only a single instruction and two tables, we only increase the interpreter by a size of 1 instruction, and also keep the base interpreter ultra fast. I affectionally call this mechanism dual dispatch. There’s a lot more that went into the design of the trace recording interpreter. I’m tooting my own horn here, but I truly think it’s a mini work of art. It took me 1 week to iterate on the interpreter until it was overall faster. It went from 6% slower to roughly no speedup after using dual dispatch. After that, I stamped out a bunch of slow edge cases in the tracing interpreter to eventually make it 1.x% faster. Tracing the interpreter itself is only 3-5x slower by my own estimations than the specializing interpreter. Key to this is that it respects all normal behavior of the specializing interpreter and mostly doesn’t interfere with it. Just to give you an idea of how much trace recording mattered: it increased the JIT code coverage by 50%. This means all future optimizations would likely have been around 50% less effective (assuming all code executes the same, which of course isn’t true, just bear with me please :). So I have to thank Brandt and Mark for leading me to stumble upon such a nice solution. Reference count elimination The other lucky bet we made early on was to try reference count elimination. This, again, was work originally by Matt Page done in CPython bytecode optimizer (more details in previous blog post on optimization). I noticed that there was still a branch left in the JITted code per reference count decrement even with the bytecode optimizer work. I thought: “why not try eliminating the branch”, and had no clue how much it would help. It turns out a single branch is actually quite expensive and these add up over time. Especially if it’s >=1 branch for every single Python instruction! The other lucky part is how easy this was to parallelize and how great it was a tool to teach people about the interpreter and JIT. This was the main optimization that we directed people to work on in the Python 3.15 JIT. Although it was a mostly manual refactoring process, it taught people the key parts they needed to learn about the JIT without overhwhelming them. Part 3: A great team We have a great infrastructure team. I say this partly in jest, because it’s one person. In reality, our “team” is currently 4 machines running in Savannah’s closet. Nevertheless Savannah has done the work equivalent of an entire infrastructure team for the JIT. The JIT could not have progressed so quickly if we had nothing to report our performance numbers. Daily JIT runs have been a game changer in the feedback loop. It helped us catch regressions in JIT performance, and lets us know our optimizations actually work. Mark is technically excellent, and I think he knows the Internet gives him too much praise already so I’m not going to say anything more here :). Diego is also great. He’s responsible for the JIT on ARM hardware, and also has recently started work on making the JIT friendly to profilers. I cannot overstate how hard of a problem this is. Brandt laid the original foundation for our machine code backend, without which we’d have new contributors writing assembler, which probably would’ve put more people off. Part 4: Talking to people I also want to encourage the idea of talking to people and sharing ideas. A shoutout to CF Bolz-Tereick, who taught me a lot about PyPy. I spent a few months looking at PyPy’s source code, and I believe this made me a better JIT developer overall. CF was very helpful when I needed help. I’m also part of a friendly compiler chat with Max Bernstein, without which I’d likely have lost motivation for this a long time ago. Max is a prolific writer, and a friendly compiler person. Ideas don’t exist in a silo. I suspect I became better at writing JITs thanks to hanging out with a bunch of compiler people for some time. At the very least, looking at PyPy has broadened my view! Conclusion People are important, and with some luck, JIT go brrr .",
+    "quality_score": 8,
+    "modules": [
+      "python_patterns",
+      "performance",
+      "evolutionary"
+    ]
+  },
+  {
+    "url": "https://blog.python.org/2025/04/python-3140a7-3133-31210-31112-31017/",
+    "title": "Python 3.14.0a7, 3.13.3, 3.12.10, 3.11.12, 3.10.17 and 3.9.22 are now available",
+    "source_name": "Python Insider",
+    "text": "Not one, not two, not three, not four, not five, but six releases! Is this the most in a single day? 3.12-3.14 were regularly scheduled, and we had some security fixes to release in 3.9-3.11 so let’s make a big day of it. This also marks the last bugfix release of 3.12 as it enters the security-only phase. See devguide.python.org/versions/ for a chart. Python 3.14.0a7 Here comes the final alpha! This means we have just four weeks until the first beta to get those last features into 3.14 before the feature freeze on 2025-05-06! https://www.python.org/downloads/release/python-3140a7/ This is an early developer preview of Python 3.14 Major new features of the 3.14 series, compared to 3.13 Python 3.14 is still in development. This release, 3.14.0a7, is the last of seven planned alpha releases. Alpha releases are intended to make it easier to test the current state of new features and bug fixes and to test the release process. During the alpha phase, features may be added up until the start of the beta phase (2025-05-06) and, if necessary, may be modified or deleted up until the release candidate phase (2025-07-22). Please keep in mind that this is a preview release and its use is not recommended for production environments. Many new features for Python 3.14 are still being planned and written. Among the new major new features and changes so far: PEP 649 : deferred evaluation of annotations PEP 741 : Python configuration C API PEP 758 : Allow except and except* expressions without parentheses PEP 761 : Python 3.14 and onwards no longer provides PGP signatures for release artifacts. Instead, Sigstore is recommended for verifiers. PEP 765 : disallow return / break / continue that exit a finally block PEP 768 : Safe external debugger interface for CPython A new type of interpreter . For certain newer compilers, this interpreter provides significantly better performance. Opt-in for now, requires building from source. UUID versions 6-8 are now supported by the uuid module, and generation of versions 3-5 and 8 are up to 40% faster. Improved error messages Python removals and deprecations C API removals and deprecations (Hey, fellow core developer, if a feature you find important is missing from this list, let Hugo know.) The next pre-release of Python 3.14 will be the first beta, 3.14.0b1, currently scheduled for 2025-05-06. After this, no new features can be added but bug fixes and docs improvements are allowed – and encouraged! Python 3.13.3 This is the third maintenance release of Python 3.13. Python 3.13 is the newest major release of the Python programming language, and it contains many new features and optimizations compared to Python 3.12. 3.13.3 is the latest maintenance release, containing almost 320 bugfixes, build improvements and documentation changes since 3.13.2. https://www.python.org/downloads/release/python-3133/ Python 3.12.10 This is the tenth maintenance release of Python 3.12. Python 3.12.10 is the latest maintenance release of Python 3.12, and the last full maintenance release. Subsequent releases of 3.12 will be security-fixes only. This last maintenance release contains about 230 bug fixes, build improvements and documentation changes since 3.12.9. https://www.python.org/downloads/release/python-31210/ Python 3.11.12 This is a security release of Python 3.11: gh-106883 : Fix deadlock in threaded application when using sys._current_frames gh-131809 : Upgrade vendored expat to 2.7.1 gh-80222 : Folding of quoted string in display_name violates RFC gh-121284 : Invalid RFC 2047 address header after refolding with email.policy.default gh-131261 : Update libexpat to 2.7.0 gh-105704 : [CVE-2025-0938] urlparse does not flag hostname containing [ or ] as incorrect gh-119511 : OOM vulnerability in the imaplib module https://www.python.org/downloads/release/python-31112/ Python 3.10.17 This is a security release of Python 3.10: gh-131809 : Upgrade vendored expat to 2.7.1 gh-80222 : Folding of quoted string in display_name violates RFC gh-121284 : Invalid RFC 2047 address header after refolding with email.policy.default gh-131261 : Update libexpat to 2.7.0 gh-105704 : CVE-2025-0938 urlparse does not flag hostname containing [ or ] as incorrect gh-119511 : OOM vulnerability in the imaplib module https://www.python.org/downloads/release/python-31017/ Python 3.9.22 This is a security release of Python 3.9: gh-131809 and gh-131261 : Upgrade vendored expat to 2.7.1 gh-121284 : Invalid RFC 2047 address header after refolding with email.policy.default gh-105704 : CVE-2025-0938 urlparse does not flag hostname containing [ or ] as incorrect gh-119511 : OOM vulnerability in the imaplib module https://www.python.org/downloads/release/python-3922/ Please upgrade! Please test! We highly recommend upgrading 3.9-3.13 and we encourage you to test 3.14. And now for something completely different On Saturday, 5th April, 3.141592653589793 months of the year had elapsed. Enjoy the new releases Thanks to all of the many volunteers who help make Python Development and these releases possible! Please consider supporting our efforts by volunteering yourself or through organisation contributions to the Python Software Foundation . Regards from a sunny and cold Helsinki springtime, Your full release team, Hugo van Kemenade Thomas Wouters Pablo Galindo Salgado Łukasz Langa Ned Deily Steve Dower",
+    "quality_score": 8,
+    "modules": [
+      "python_patterns",
+      "dependency_health",
+      "evolutionary"
+    ]
+  },
+  {
+    "url": "https://blog.python.org/2026/03/python-31213-31115-31020/",
+    "title": "Python 3.12.13, 3.11.15 and 3.10.20 are now available!",
+    "source_name": "Python Insider",
+    "text": "Python Releases For Your Security! New security releases for 3.10, 3.11 and 3.12 are now available. (As these Python versions are now in security-fix-only mode, these are source-only releases, and there is no pre-set release cadence.) Security content in these releases Email and header-related gh-144125 : email.generator.BytesGenerator now refuses to serialize headers that are unsafely folded or delimited (see email.policy.Policy.verify_generated_headers ); addressing CVE-2024-6923 . gh-143935 : Fixed comment folding in modern email policies to prevent header injection when very long non-foldable comment text is wrapped. gh-136063 : email.message now ensures linear complexity for legacy HTTP parameter parsing. HTTP, cookies, and URL parsing-related gh-143916 : wsgiref.headers.Headers now rejects C0 control characters in fields, values, and parameters. gh-143919 : http.cookies.Morsel now rejects control characters in fields and values. gh-143925 : data: URL media types now reject control characters. gh-144363 : Upgraded bundled libexpat to 2.7.4 to fix CVE-2026-24515 and CVE-2026-25210 . gh-90949 : Added Expat allocation-tracker APIs to xml.parsers.expat parser objects to limit memory amplification from malicious XML input; includes mitigation for CVE-2025-59375 . gh-142145 : Removed quadratic behavior in xml.dom.minidom node ID cache clearing. Denial-of-service hardening gh-119342 : Fixed a potential memory denial of service in plistlib . gh-119451 : Fixed a potential memory denial of service in http.client . gh-119452 : Fixed a potential memory denial of service in http.server (CGI server on Windows). gh-136065 : Fixed quadratic complexity in os.path.expandvars() . gh-137836 : Hardened html.parser.HTMLParser with support for additional RAWTEXT/PLAINTEXT elements ( plaintext , xmp , iframe , noembed , noframes , optional noscript ), improving robust handling of hostile markup. SSL memory-safety fixes gh-144833 : Fixed a use-after-free in ssl when SSL_new() fails. Python 3.12.13 https://www.python.org/downloads/release/python-31213/ Python 3.11.15 Additional fixes in this release (they were already included in a previous 3.12 release): gh-120298 : Fixed a use-after-free in list rich comparison handling ( list_richcompare_impl ) for specially crafted concurrent inputs. gh-120384 : Fixed an out-of-bounds access in list slice assignment ( list_ass_subscript ) under specially crafted concurrent inputs. https://www.python.org/downloads/release/python-31115/ Python 3.10.20 Additional fixes in this release (they were already included in a previous 3.12 release): gh-120298 : Fixed a use-after-free in list rich comparison handling ( list_richcompare_impl ) for specially crafted concurrent inputs. gh-120384 : Fixed an out-of-bounds access in list slice assignment ( list_ass_subscript ) under specially crafted concurrent inputs. https://www.python.org/downloads/release/python-31020/ Stay safe and upgrade! As always, upgrading is highly recommended to all users of affected versions. Enjoy the new releases Thanks to all of the many volunteers who help make Python Development and this release possible! Please consider supporting our efforts by volunteering yourself or through organisation contributions to the Python Software Foundation . Regards from your security-fix release team, Thomas Wouters Pablo Galindo Salgado",
+    "quality_score": 8,
+    "modules": [
+      "dependency_health",
+      "security",
+      "python_patterns"
+    ]
+  },
+  {
+    "url": "https://quarkus.io/blog/quarkus-3-33-released/",
+    "title": "Quarkus 3.33 LTS - new LTS version",
+    "source_name": "Quarkus Blog",
+    "text": "Blog Quarkus 3.33 LTS - new LTS version\n\nMarch 25, 2026 #release#lts\nQuarkus 3.33 LTS - new LTS version\n\nBy  Guillaume Smet\n\nIt is our pleasure to announce the release of Quarkus 3.33, which is our new LTS (Long Term Support) version.\n\nThis version is built on the top of Quarkus 3.32. New features landed in Quarkus 3.34, which was also released today.\n\nIf you want to know more about our LTS policy, the LTS announcement is a must read.\n\nLTS releases are supported for 12 months.\n\nIf you are coming from the previous LTS, Quarkus 3.27 LTS, there are a lot of exciting new features and we recommend reading the following announcements:\n\nQuarkus 3.28 - More security features, custom Grafana dashboards, support for multiple clients in Liquibase MongoDB, and more\n\nQuarkus 3.29 - Multiple cache backends and Qute DAP debugger support\n\nQuarkus 3.30 - JsonView on REST Client, Hibernate Validator 9.1, CLI decrypt command, and more\n\nQuarkus 3.31 - Full Java 25 support, Quarkus Maven packaging, Panache Next, and more!\n\nQuarkus 3.32 - Project Leyden integration, more graceful shutdown, automatic Consul registration and more!\n\nUpdate\n\nTo update to Quarkus 3.33 LTS, we recommend updating to the latest version of the Quarkus CLI and run:\n\nquarkus update\n\nNote that quarkus update can update your applications from any version of Quarkus (including 2.x) to Quarkus 3.33 LTS.\n\nIf you are upgrading from 3.32, there’s nothing to do as 3.33 LTS is the direct continuation of 3.32.\n\nIf you are upgrading from the previous LTS, Quarkus 3.27 LTS, please refer to the following migration guides:\n\nMigration guide for 3.28\n\nMigration guide for 3.29\n\nMigration guide for 3.30\n\nMigration guide for 3.31\n\nMigration guide for 3.32\n\nMigration guide for 3.33 - this one is empty as 3.33 is the continuation of 3.32\n\nNote that quarkus update should handle most of the heavy lifting for you, but there are still cases that should be handled manually and we recommend reading these migration guides carefully.\n\nWhat’s new?\nPlatform component upgrades\n\nVarious Platform components were upgraded including:\n\nQuarkus CXF to 3.33.0 - see release notes\n\nCamel Quarkus to 3.33.0\n\nQuarkus Operator SDK to 7.7.3\n\nQuarkus Vault to 4.7.0\n\nQuarkus Qpid JMS to 2.12.0\n\nFull changelog\n\nThe core part of Quarkus 3.33 LTS is based on Quarkus 3.32 with some additional fixes included in 3.33.1.\n\nYou can get the full changelog of 3.33.1 on GitHub.\n\nContributors\n\nThe Quarkus community is growing and has now 1173 contributors. Many many thanks to each and everyone of them.\n\nIn particular for the 3.33 release, thanks to Ales Justin, Alexey Loubyansky, Andy Damevin, Asger Askov Blekinge, Aurea Munoz, Aurélien Pupier, brunobat, Clement Escoffier, Clément de Tastes, David M. Lloyd, Dmitri Bourlatchkov, Erwin Oegema, Faisal Dilawar, Foivos Zakkak, Gaelle Fournier, George Gastaldi, Georgios Andrianakis, Guillaume Smet, Holly Cummins, Jakub Jedlicka, jcarranzan, Jens Teglhus Møller, Julien Ponge, Katia Aresti, Kristian Rickert, Ladislav Thon, Luca Molteni, Martin Kouba, Martin Panzer, María Arias de Reyna Domínguez, Matej Novotny, Michal Maléř, Michal Vavřík, Nico Hinrichs, Ozan Gunalp, Patrick Schaub, Phillip Kruger, Roberto Cortez, Sanne Grinovero, Sergey Beryozkin, shjones, Stéphane Épardaud, Thomas McWork, tiwari91, Tom Schindl, and Yoann Rodière.\n\nThe list is a bit smaller than usual as 3.33 LTS only contains bugfixes on top of 3.32.\n\nCome Join Us\n\nWe value your feedback a lot so please report bugs, ask for improvements…​ Let’s build something great together!\n\nIf you are a Quarkus user or just curious, don’t be shy and join our welcoming community:\n\nprovide feedback on GitHub;\n\ncraft some code and push a PR;\n\ndiscuss with us on Zulip and on the mailing list;\n\nask your questions on Stack Overflow.\n\nQuarkus is open. All dependencies of this project are available under the Apache Software License 2.0 or compatible license. CC by 3.0\n\nThis website was built with Jekyll, is hosted on GitHub Pages and is completely open source. If you want to make it better, fork the website and show us what you’ve got.\n\nNavigation\nHome\nAbout\nBlog\nPodcast\nEvents\nNewsletter\nUser Stories\nRoadmap\nSecurity policy\nUsage\nBrand\nWallpapers\nPrivacy Policy\nFollow Us\nX\nBluesky\nMastodon\nThreads\nFacebook\nLinkedin\nYoutube\nGitHub\nGet Help\nSupport\nGuides\nFAQ\nGet Started\nStack Overflow\nDiscussions\nDevelopment mailing list\nQuarkus Service Status\nLanguages\nEnglish\nPortuguês (Brasileiro)\nEspañol\n简体中文\n日本語\nQuarkus is made of community projects\nEclipse Vert.x\nSmallRye\nHibernate\nNetty\nRESTEasy\nApache Camel\nEclipse MicroProfile\nAnd many more...\nCopyright © Quarkus. All rights reserved. For details on our trademarks, please visit our Trademark Policy and Trademark List. Trademarks of third parties are owned by their respective holders and their mention here does not suggest any endorsement or association.",
+    "quality_score": 8,
+    "modules": [
+      "java_patterns",
+      "dependency_health",
+      "devops"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2026/02/24/the-react-foundation",
+    "title": "The React Foundation: A New Home for React Hosted by the Linux Foundation",
+    "source_name": "React Blog",
+    "text": "February 24, 2026 by Matt Carroll The React Foundation has officially launched, hosted by the Linux Foundation. In October , we announced our intent to form the React Foundation. Today, we’re excited to share that the React Foundation has officially launched. React, React Native, and supporting projects like JSX are no longer owned by Meta — they are now owned by the React Foundation, an independent foundation hosted by the Linux Foundation. You can read more in the Linux Foundation’s press release . Founding Members The React Foundation has eight Platinum founding members: Amazon , Callstack , Expo , Huawei , Meta , Microsoft , Software Mansion , and Vercel . Huawei has joined since our announcement in October . The React Foundation will be governed by a board of directors composed of representatives from each member, with Seth Webster serving as executive director. New Provisional Leadership Council React’s technical governance will always be independent from the React Foundation board — React’s technical direction will continue to be set by the people who contribute to and maintain React. We have formed a provisional leadership council to determine this structure. We will share an update in the coming months. Next Steps There is still work to do to complete the transition. In the coming months we will be: Finalizing the technical governance structure for React Transferring repositories, websites, and other infrastructure to the React Foundation Exploring programs to support the React ecosystem Kicking off planning for the next React Conf We will share updates as this work progresses. Thank You None of this would be possible without the thousands of contributors who have shaped React over the past decade. Thank you to our founding members, to every contributor who has opened a pull request, filed an issue, or helped someone learn React, and to the millions of developers who build with React every day. The React Foundation exists because of this community, and we’re looking forward to building its future together.",
+    "quality_score": 8,
+    "modules": [
+      "react_patterns",
+      "evolutionary",
+      "design_patterns"
+    ]
+  },
+  {
+    "url": "https://blog.python.org/2026/04/rust-for-cpython-2026-04/",
+    "title": "Rust for CPython Progress Update April 2026",
+    "source_name": "Python Insider",
+    "text": "This post has also been shared on discuss.python.org . We (the Rust for CPython community) wanted to provide an update on where the project is and our current plans from now to a Python Enhancement Proposal (PEP) for introducing Rust into CPython. Recent work Since the pre-PEP thread , we’ve been working on making the reference implementation build system more robust across the platforms CPython supports. We’re now successfully building CPython with Rust in our fork’s CI on all tested platforms. We’ve also had a number of productive discussions with the Rust team, who have been incredibly generous to meet with us to discuss the needs of the CPython project and how best to address issues we face with integrating Rust with CPython. I’m incredibly grateful to everyone who has joined those meetings. We’ve also had some discussions about the design of a Rust API for CPython. You can see issues tagged api-design which cover the critical components of the API design. We’d love to get more input on designing the Rust API, so please see below about contributing if you are interested in working with us on the Rust API. As a reminder, this API will remain internal until a later PEP stabilizes it and makes it public. Roadmap to a PEP Since the pre-PEP, we’ve decided that we will be targeting Python 3.16 rather than 3.15 as the first Python version to include Rust code. This gives us a year to make the reference implementation the best it can be and plenty of time for discussion of the PEP. The below timeline is subject to change, but covers a rough plan of what and when we hope to accomplish things: March Done! Finish the build system work, ensuring platforms tested in CPython CI are green April Start planning the internal Rust API design Select a single extension module to have a Rust implementation in 3.16 May Finalize a plan for the internal Rust API design Start implementing the internal Rust API Sprint at PyConUS on the internal Rust API and the extension module June Start writing the PEP July Finalize the PEP draft Submit the PEP and begin discussion We recognize introducing Rust is a significant change, and expect the PEP discussion to be lengthy, so we want to make sure there is ample time to discuss it prior to 3.16 beta 1 in May 2027 . Contributing Interested in contributing to the Rust for CPython project? Please join our Discord ! We have meetings every Monday at 12:00PM PDT to discuss the project. We’d love to have more folks join those meetings and work with us on Rust for CPython!",
+    "quality_score": 8,
+    "modules": [
+      "python_patterns",
+      "evolutionary",
+      "complexity"
+    ]
   }
 ]


--- src/content/article-extractor.ts
diff --git a/src/content/article-extractor.ts b/src/content/article-extractor.ts
index 3269469..ec1f3eb 100644
--- a/src/content/article-extractor.ts
+++ b/src/content/article-extractor.ts
@@ -13,7 +13,9 @@ const MIN_WORD_COUNT_RESULT = 100;   // below this = extraction failed
 const MIN_WORD_COUNT_ACCEPT = 300;   // below this = use Puppeteer fallback for curated
 const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
 const DEFAULT_PUPPETEER_FALLBACK_HOSTS = [
+  'blog.python.org',
   'discord.com',
+  'quarkus.io',
   'stripe.com',
   'www.linkedin.com',
 ] as const;
@@ -135,18 +137,19 @@ async function extractFromUrl(url: string): Promise<ArticleText | null> {
 
       const signal = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
       const article = await extract(url, {}, { signal, headers: profile.headers });
-      if (!article?.content) return null;
-
-      const text = stripHtml(article.content);
-      const wordCount = countWords(text);
-      if (wordCount < MIN_WORD_COUNT_RESULT) return null;
-
-      return {
-        title: article.title ?? '',
-        text,
-        wordCount,
-        publishedAt: article.published ? new Date(article.published) : null,
-      };
+      const normalizedArticle = normalizeExtractedArticle(article);
+      if (normalizedArticle) return normalizedArticle;
+
+      const htmlFallback = await extractFromHtml(url, profile.headers);
+      if (htmlFallback) {
+        logger.info('content.extract.url.html_fallback', {
+          url,
+          host,
+          profile: profile.name,
+          wordCount: htmlFallback.wordCount,
+        });
+        return htmlFallback;
+      }
     } catch (err) {
       logger.debug('content.extract.url.fail', {
         url,
@@ -170,6 +173,82 @@ async function extractFromUrl(url: string): Promise<ArticleText | null> {
   return null;
 }
 
+function normalizeExtractedArticle(
+  article: {
+    title?: string | null;
+    content?: string | null;
+    published?: string | Date | null;
+  } | null | undefined,
+): ArticleText | null {
+  if (!article?.content) return null;
+
+  const text = stripHtml(article.content);
+  const wordCount = countWords(text);
+  if (wordCount < MIN_WORD_COUNT_RESULT) return null;
+
+  return {
+    title: article.title ?? '',
+    text,
+    wordCount,
+    publishedAt: article.published ? new Date(article.published) : null,
+  };
+}
+
+async function extractFromHtml(
+  url: string,
+  headers: Record<string, string>,
+): Promise<ArticleText | null> {
+  const host = getHostname(url);
+
+  try {
+    const signal = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
+    const response = await fetch(url, {
+      headers,
+      redirect: 'follow',
+      signal,
+    });
+
+    if (!response.ok) {
+      logger.debug('content.extract.html_fetch.bad_status', {
+        url,
+        host,
+        status: response.status,
+      });
+      return null;
+    }
+
+    const contentType = response.headers.get('content-type') ?? '';
+    if (!contentType.includes('html')) {
+      logger.debug('content.extract.html_fetch.unsupported_type', {
+        url,
+        host,
+        contentType,
+      });
+      return null;
+    }
+
+    const html = await response.text();
+    const htmlSlice = extractRelevantHtml(url, html);
+    const text = stripHtml(htmlSlice);
+    const wordCount = countWords(text);
+    if (wordCount < MIN_WORD_COUNT_RESULT) return null;
+
+    return {
+      title: extractHtmlTitle(html),
+      text,
+      wordCount,
+      publishedAt: extractPublishedAtFromHtml(html),
+    };
+  } catch (err) {
+    logger.debug('content.extract.html_fetch.fail', {
+      url,
+      host,
+      error: String(err),
+    });
+    return null;
+  }
+}
+
 async function extractWithPuppeteer(url: string): Promise<ArticleText | null> {
   // Dynamic import to avoid loading Puppeteer when it is not needed
   let browser: {
@@ -280,6 +359,71 @@ export function countWords(text: string): number {
   return text.split(/\s+/).filter((w) => w.length > 0).length;
 }
 
+function extractRelevantHtml(url: string, html: string): string {
+  const host = getHostname(url);
+
+  const hostSpecificSlice = (
+    host === 'quarkus.io'
+      ? sliceBetween(
+          html,
+          /<div\b[^>]*class="[^"]*\bdoc-content\b[^"]*"[^>]*>/i,
+          /<div\b[^>]*class="[^"]*\bproject-footer\b[^"]*"[^>]*>/i,
+        )
+      : null
+  );
+
+  return hostSpecificSlice
+    ?? extractTagContent(html, 'article')
+    ?? extractTagContent(html, 'main')
+    ?? extractTagContent(html, 'body')
```

### Commit 2: a884538
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

### Commit 3: afa2650
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

### Commit 4: ce19f33
**Message:** feat: expand seed corpus to 100 articles

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index 2cd5a5c..3f0747c 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -93,3 +93,9 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 92,track2,js_advanced,"api_design,architecture_patterns",https://blog.cloudflare.com/javascript-native-rpc/,"We've added JavaScript-native RPC to Cloudflare Workers","Cloudflare Blog","Kenton Varda",2024-04-05,9,"A high-signal article on designing RPC that feels like local JavaScript, with security, ergonomics, and service-composition tradeoffs made explicit.",kept,,
 93,track2,js_advanced,"integration,dx",https://blog.cloudflare.com/blazing-fast-development-with-full-stack-frameworks-and-cloudflare/,"Blazing fast development with full-stack frameworks and Cloudflare","Cloudflare Blog","Igor Minar; Dario Piotrowicz; James Culveyhouse; Peter Bacon Darwin",2024-04-05,8,"A useful full-stack JavaScript article on local dev loops, framework adapters, D1/R2 integration, and making distributed platform features feel native in app code.",kept,,
 94,track2,java_patterns,"clean_code,complexity",https://quarkus.io/blog/arc-migrates-to-gizmo2/,"ArC migrates to Gizmo 2","Quarkus Blog","Ladislav Thon",2025-11-03,8,"A valuable Java internals article on bytecode generation APIs, migration tradeoffs, and how lower-level extension APIs evolve without breaking application users.",kept,,
+95,track2,go_patterns,"type_system,api_design",https://go.dev/blog/generic-interfaces,"Generic interfaces","The Go Blog","Axel Wagner",2025-07-07,8,"A strong generics article that goes beyond syntax and gets into constraint design, zero-value ergonomics, and how API shape affects runtime cost and usability.",kept,,
+96,track2,go_patterns,"testing,concurrency",https://go.dev/blog/testing-time,"Testing Time (and other asynchronicities)","The Go Blog","Damien Neil",2025-08-26,9,"A very practical Go testing article that makes concurrent time-based code less flaky, while showing concrete patterns teams can apply to real async systems.",kept,,
+97,track2,go_patterns,"observability,api_design",https://go.dev/blog/slog,"Structured Logging with slog","The Go Blog","Jonathan Amsterdam",2023-08-22,8,"A useful standard-library design article on structured logging, handler interfaces, and the performance tradeoffs behind a widely adopted observability API.",kept,,
+98,track2,go_patterns,"evolutionary,api_design",https://go.dev/blog/range-functions,"Range Over Function Types","The Go Blog","Ian Lance Taylor",2024-08-20,8,"A high-signal language-evolution article that explains why range-over-functions exists, what API shape it enables, and how iterator patterns become first-class in Go.",kept,,
+99,track2,react_patterns,"api_design,performance",https://react.dev/blog/2024/12/05/react-19,"React v19","React Blog","The React Team",2024-12-05,9,"A strong framework-level write-up on Actions, useOptimistic, forms, and ref changes, with enough detail to ground real React architecture and performance decisions.",kept,,
+100,track2,react_patterns,"type_system,dx",https://react.dev/blog/2024/04/25/react-19-upgrade-guide,"React 19 Upgrade Guide","React Blog","Ricky Hanlon",2024-04-25,8,"A practical migration guide with codemods, breaking changes, and TypeScript updates, which makes it especially useful seed material for React and type-system tradeoffs.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index d31de01..9a9541e 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -1125,5 +1125,77 @@
       "clean_code",
       "complexity"
     ]
+  },
+  {
+    "url": "https://go.dev/blog/generic-interfaces",
+    "title": "Generic interfaces",
+    "source_name": "The Go Blog",
+    "text": "There is an idea that is not obvious until you hear about it for the first time: as interfaces are types themselves, they too can have type parameters. This idea proves to be surprisingly powerful when it comes to expressing constraints on generic functions and types. In this post, we’ll demonstrate it, by discussing the use of interfaces with type parameters in a couple of common scenarios. A simple tree set As a motivating example, assume we need a generic version of a binary search tree . The elements stored in such a tree need to be ordered, so our type parameter needs a constraint that determines the ordering to use. A simple option is to use the cmp.Ordered constraint, introduced in Go 1.21. It restricts a type parameter to ordered types (strings and numbers) and allows methods of the type to use the built-in ordering operators. // The zero value of a Tree is a ready-to-use empty tree. type Tree[E cmp.Ordered] struct { root *node[E] } func (t *Tree[E]) Insert(element E) { t.root = t.root.insert(element) } type node[E cmp.Ordered] struct { value E left *node[E] right *node[E] } func (n *node[E]) insert(element E) *node[E] { if n == nil { return &node[E]{value: element} } switch { case element < n.value: n.left = n.left.insert(element) case element > n.value: n.right = n.right.insert(element) } return n } ( playground ) However, this approach has the disadvantage that it only works on basic types for which < is defined; you cannot insert struct types, like time.Time . We can remedy that by requiring the user to provide a comparison function: // A FuncTree must be created with NewFuncTree. type FuncTree[E any] struct { root *funcNode[E] cmp func(E, E) int } func NewFuncTree[E any](cmp func(E, E) int) *FuncTree[E] { return &FuncTree[E]{cmp: cmp} } func (t *FuncTree[E]) Insert(element E) { t.root = t.root.insert(t.cmp, element) } type funcNode[E any] struct { value E left *funcNode[E] right *funcNode[E] } func (n *funcNode[E]) insert(cmp func(E, E) int, element E) *funcNode[E] { if n == nil { return &funcNode[E]{value: element} } sign := cmp(element, n.value) switch { case sign < 0: n.left = n.left.insert(cmp, element) case sign > 0: n.right = n.right.insert(cmp, element) } return n } ( playground ) This works, but it also comes with downsides. We can no longer use the zero value of our container type, because it needs to have an explicitly initialized comparison function. And the use of a function field makes it harder for the compiler to inline the comparison calls, which can introduce a significant runtime overhead. Using a method on the element type can solve these issues, because methods are directly associated with a type. A method does not have to be explicitly passed and the compiler can see the target of the call and may be able to inline it. But how can we express the constraint to require that element types provide the necessary method? Using the receiver in constraints The first approach we might try is to define a plain old interface with a Compare method: type Comparer interface { Compare(Comparer) int } However, we quickly realize that this does not work well. To implement this interface, the method’s parameter must itself be Comparer . Not only does that mean that the implementation of this method must type-assert the parameter to its own type, it also requires that every type must explicitly refer to our package with the Comparer type by name (otherwise the method signatures would not be identical). That is not very orthogonal. A better approach is to make the Comparer interface itself generic: type Comparer[T any] interface { Compare(T) int } This Comparer now describes a whole family of interfaces, one for each type that Comparer may be instantiated with. A type that implements Comparer[T] declares “I can compare myself to a T ”. For instance, time.Time naturally implements Comparer[time.Time] because it has a matching Compare method : // Implements Comparer[Time] func (t Time) Compare(u Time) int This is better, but not enough. What we really want is a constraint that says that a type parameter can be compared to itself : we want the constraint to be self-referential. The subtle insight is that the self-referential aspect does not have to be part of the interface definition itself; specifically, the constraint for T in the Comparer type is just any . Instead, it is a consequence of how we use Comparer as a constraint for the type parameter of MethodTree : // The zero value of a MethodTree is a ready-to-use empty tree. type MethodTree[E Comparer[E]] struct { root *methodNode[E] } func (t *MethodTree[E]) Insert(element E) { t.root = t.root.insert(element) } type methodNode[E Comparer[E]] struct { value E left *methodNode[E] right *methodNode[E] } func (n *methodNode[E]) insert(element E) *methodNode[E] { if n == nil { return &methodNode[E]{value: element} } sign := element.Compare(n.value) switch { case sign < 0: n.left = n.left.insert(element) case sign > 0: n.right = n.right.insert(element) } return n } ( playground ) Because time.Time implements Comparer[time.Time] it is now a valid type argument for this container, and we can still use the zero value as an empty container: var t MethodTree[time.Time] t.Insert(time.Now()) For full flexibility, a library can provide all three API versions. If we want to minimize repetition, all versions could use a shared implementation. We could use the function version for that, as it is the most general: type node[E any] struct { value E left *node[E] right *node[E] } func (n *node[E]) insert(cmp func(E, E) int, element E) *node[E] { if n == nil { return &node[E]{value: element} } sign := cmp(element, n.value) switch { case sign < 0: n.left = n.left.insert(cmp, element) case sign > 0: n.right = n.right.insert(cmp, element) } return n } // Insert inserts element into the tree, if E implements cmp.Ordered. func (t *Tree[E]) Insert(element E) { t.root = t.root.insert(cmp.Compare[E], element) } // Insert inserts element into the tree, using the provided comparison function. func (t *FuncTree[E]) Insert(element E) { t.root = t.root.insert(t.cmp, element) } // Insert inserts element into the tree, if E implements Comparer[E]. func (t *MethodTree[E]) Insert(element E) { t.root = t.root.insert(E.Compare, element) } ( playground ) An important observation here is that the shared implementation (the function-based variant) is not constrained in any way. It must remain maximally flexible to serve as a common core. We also do not store the comparison function in a struct field. Instead, we pass it as a parameter because function arguments are easier for the compiler to analyze than struct fields. There is still some amount of boilerplate involved, of course. All the exported implementations need to replicate the full API with slightly different call patterns. But this part is straightforward to write and to read. Combining methods and type sets We can use our new tree data structure to implement an ordered set, providing element lookup in logarithmic time. Let’s now imagine we need to make lookup run in constant time; we might try to do this by maintaining an ordinary Go map alongside the tree: type OrderedSet[E Comparer[E]] struct { tree MethodTree[E] // for efficient iteration in order elements map[E]bool // for (near) constant time lookup } func (s *OrderedSet[E]) Has(e E) bool { return s.elements[e] } func (s *OrderedSet[E]) Insert(e E) { if s.elements == nil { s.elements = make(map[E]bool) } if s.elements[e] { return } s.elements[e] = true s.tree.Insert(e) } func (s *OrderedSet[E]) All() iter.Seq[E] { return func(yield func(E) bool) { s.tree.root.all(yield) } } func (n *node[E]) all(yield func(E) bool) bool { return n == nil || (n.left.all(yield) && yield(n.value) && n.right.all(yield)) } ( playground ) However, compiling this code will produce an error: invalid map key type E (missing comparable constraint) The error message tells us that we need to further constrain our type parameter to be able to use it as a map key. The comparable constraint is a special predeclared constraint that is satisfied by all types for which the equality operators == and != are defined. In Go, that is also the set of types which can be used as keys for the built-in map type. We have three options to add this constraint to our type parameter, all with different tradeoffs: We can embed comparable into our original Comparer definition ( playground ): type Comparer[E any] interface { comparable Compare(E) int } This has the downside that it would also make our Tree types only usable with types that are comparable . In general, we do not want to unnecessarily restrict generic types. We can add a new constraint definition ( playground ). type Comparer[E any] interface { Compare(E) int } type ComparableComparer[E any] interface { comparable Comparer[E] } This is tidy, but it introduces a new identifier ( ComparableComparer ) into our API, and naming is hard. We can add the constraint inline into our more constrained type ( playground ): type OrderedSet[E interface { comparable Comparer[E] }] struct { tree Tree[E] elements map[E]struct{} } This can become a bit hard to read, especially if it needs to happen often. It also makes it harder to reuse the constraint in other places. Which of these to use is a style choice and ultimately up to personal preference. (Not) constraining generic interfaces At this point it is worth discussing constraints on generic interfaces. You might want to define an interface for a generic container type. For example, say you have an algorithm that requires a set data structure. There are many different kinds of set implementations with different tradeoffs. Defining an interface for the set operations you require can add flexibility to your package, leaving the decision of what tradeoffs are right for the specific application to the user: type Set[E any] interface { Insert(E) Delete(E) Has(E) bool All() iter.Seq[E] } A natural question here is what the constraint on this interface should be. If possible, type parameters on generic interfaces should use any as a constraint, allowing arbitrary types. From our discussions above, the reasons should be clear: Different concrete implementations might require different constraints. All the Tree types we have examined above, as well as the OrderedSet type, can implement Set for their element types, even though these types have different constraints. The point of defining an interface is to leave the implementation up to the user. Since one cannot predict what kinds of constraints a user may want to impose on their implementation, try to leave any constraints (stronger than any ) to concrete implementations, not the interfaces. Pointer receivers Let us try to use the Set interface in an example. Consider a function that removes duplicate elements in a sequence: // Unique removes duplicate elements from the input sequence, yielding only // the first instance of any element. func Unique[E comparable](input iter.Seq[E]) iter.Seq[E] { return func(yield func(E) bool) { seen := make(map[E]bool) for v := range input { if seen[v] { continue } if !yield(v) { return } seen[v] = true } } } ( playground ) This uses a map[E]bool as a simple set of E elements. Consequently, it works only for types that are comparable and which therefore define the built-in equality operators. If we want to generalize this to arbitrary types, we need to replace that with a generic set: // Unique removes duplicate elements from the input sequence, yielding only // the first instance of any element. func Unique[E any](input iter.Seq[E]) iter.Seq[E] { return func(yield func(E) bool) { var seen Set[E] for v := range input { if seen.Has(v) { continue } if !yield(v) { return } seen.Insert(v) } } } ( playground ) However, this does not work. Set[E] is an interface type, and the seen variable will be initialized to nil . We need to use a concrete implementation of the Set[E] interface. But as we have seen in this post, there is no general implementation of a set that works for any element type. We have to ask the user to provide a concrete implementation we can use, as an extra type parameter: // Unique removes duplicate elements from the input sequence, yielding only // the first instance of any element. func Unique[E any, S Set[E]](input iter.Seq[E]) iter.Seq[E] { return func(yield func(E) bool) { var seen S for v := range input { if seen.Has(v) { continue } if !yield(v) { return } seen.Insert(v) } } } ( playground ) However, if we instantiate this with our set implementation, we run into another problem: // OrderedSet[E] does not satisfy Set[E] (method All has pointer receiver) Unique[E, OrderedSet[E]](slices.Values(s)) // panic: invalid memory address or nil pointer dereference Unique[E, *OrderedSet[E]](slices.Values(s)) The first problem is clear from the error message: Our type constraint says that the type argument for S needs to implement the Set[E] interface. And as the methods on OrderedSet use a pointer receiver, the type argument also has to be the pointer type. When trying to do that, we run into the second problem. This stems from the fact that we declare a variable in the implementation: var seen S If S is *OrderedSet[E] , the variable is initialized with nil , as before. Calling seen.Insert panics. If we only have the pointer type, we cannot get a valid variable of the value type. And if we only have the value type, we cannot call pointer-methods on it. The consequence is that we need both the value and the pointer type. So we have to introduce an additional type parameter PS with a new constraint PtrToSet : // PtrToSet is implemented by a pointer type implementing the Set[E] interface. type PtrToSet[S, E any] interface { *S Set[E] } // Unique removes duplicate elements from the input sequence, yielding only // the first instance of any element. func Unique[E, S any, PS PtrToSet[S, E]](input iter.Seq[E]) iter.Seq[E] { return func(yield func(E) bool) { // We convert to PS, as only that is constrained to have the methods. // The conversion is allowed, because the type set of PS only contains *S. seen := PS(new(S)) for v := range input { if seen.Has(v) { continue } if !yield(v) { return } seen.Insert(v) } } } ( playground ) The trick here is the connection of the two type parameters in the function signature via the extra type parameter on the PtrToSet interface. S itself is unconstrained, but PS must have type *S and it must have the methods we need. So effectively, we are restricting S to have some methods, but those methods need to use a pointer receiver. While the definition of a function with this kind of constraint requires an additional type parameter, importantly this does not complicate code using it: as long as this extra type parameter is at the end of the type parameter list, it can be inferred : // The third type argument is inferred to be *OrderedSet[int] Unique[int, OrderedSet[int]](slices.Values(s)) This is a general pattern, and worth remembering: for when you encounter it in someone else’s work, or when you want to use it in your own. func SomeFunction[T any, PT interface{ *T; SomeMethods }]() If you have two type parameters, where one is constrained to be a pointer to the other, the constraint ensures that the relevant methods use a pointer receiver. Should you constrain to pointer receivers? At this point, you might feel pretty overwhelmed. This is rather complicated and it seems unreasonable to expect every Go programmer to understand what is going on in this function signature. We also had to introduce yet more names into our API. When people cautioned against adding generics to Go in the first place, this is one of the things they were worried about. So if you find yourself entangled in these problems, it is worth taking a step back. We can often avoid this complexity by thinking about our problem in a different way. In this example, we built a function that takes an iter.Seq[E] and returns an iter.Seq[E] with the unique elements. But to do the deduplication, we needed to collect the unique elements into a set. And as this requires us to allocate the space for the entire result, we do not really benefit from representing the result as a stream. If we rethink this problem, we can avoid the extra type parameter altogether by using Set[E] as a regular interface value: // InsertAll adds all unique elements from seq into set. func InsertAll[E any](set Set[E], seq iter.Seq[E]) { for v := range seq { set.Insert(v) } } ( playground ) By using Set as a plain interface type, it is clear that the caller has to provide a valid value of their concrete implementation. This is a very common pattern. And if they need an iter.Seq[E] , they can simply call All() on the set to obtain one. This complicates things for callers slightly, but it has another advantage over the constraint to pointer receivers: remember that we started with a map[E]bool as a simple set type. It is easy to implement the Set[E] interface on that basis: type HashSet[E comparable] map[E]bool func (s HashSet[E]) Insert(v E) { s[v] = true } func (s HashSet[E]) Delete(v E) { delete(s, v) } func (s HashSet[E]) Has(v E) bool { return s[v] } func (s HashSet[E]) All() iter.Seq[E] { return maps.Keys(s) } ( playground ) This implementation does not use pointer receivers. So while this is perfectly valid, it would not be usable with the complicated constraint to pointer receivers. But it works fine with our InsertAll version. As with many constraints, enforcing that methods use a pointer receiver might actually be overly restrictive for many practical use cases. Conclusion I hope this illustrates some of the patterns and trade-offs that type parameters on interfaces enable. It is a powerful tool, but it also comes with a cost. The primary take-aways are: Use generic interfaces to express constraints on the receiver by using them self-referentially. Use them to create constrained relationships between different type parameters. Use them to abstract over different implementations with different kinds of constraints. When you find yourself in a situation where you need to constrain to pointer receivers, consider whether you can refactor your code to avoid the extra complexity. See “Should you constrain to pointer receivers?” . As always, do not over-engineer things: a less flexible but simpler and more readable solution may ultimately be the wiser choice.",
+    "quality_score": 8,
+    "modules": [
+      "go_patterns",
+      "type_system",
+      "api_design"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/testing-time",
+    "title": "Testing Time (and other asynchronicities)",
+    "source_name": "The Go Blog",
+    "text": "In Go 1.24, we introduced the testing/synctest package as an experimental package. This package can significantly simplify writing tests for concurrent, asynchronous code. In Go 1.25, the testing/synctest package has graduated from experiment to general availability. What follows is the blog version of my talk on the testing/synctest package at GopherCon Europe 2025 in Berlin. What is an asynchronous function? A synchronous function is pretty simple. You call it, it does something, and it returns. An asynchronous function is different. You call it, it returns, and then it does something. As a concrete, if somewhat artificial, example, the following Cleanup function is synchronous. You call it, it deletes a cache directory, and it returns. func (c *Cache) Cleanup() { os.RemoveAll(c.cacheDir) } CleanupInBackground is an asynchronous function. You call it, it returns, and the cache directory is deleted…sooner or later. func (c *Cache) CleanupInBackground() { go os.RemoveAll(c.cacheDir) } Sometimes an asynchronous function does something in the future. For example, the context package’s WithDeadline function returns a context which will be canceled in the future. package context // WithDeadline returns a derived context // with a deadline no later than d. func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) When I talk about testing concurrent code, I mean testing these sorts of asynchronous operations, both ones which use real time and ones which do not. Tests A test verifies that a system behaves as we expect. There’s a lot of terminology describing types of test–unit tests, integration tests, and so on–but for our purposes here every kind of test reduces to three steps: Set up some initial conditions. Tell the system under test to do something. Verify the result. Testing a synchronous function is straightforward: You call the function; the function does something and returns; you verify the result. Testing an asynchronous function, however, is tricky: You call the function; it returns; you wait for it to finish doing whatever it does; you verify the result. If you don’t wait for the correct amount of time, you may find yourself verifying the result of an operation that hasn’t happened yet or has only happened partially. This never ends well. Testing an asynchronous function is especially tricky when you want to assert that something has not happened. You can verify that the thing has not happened yet, but how do you know with certainty that it isn’t going to happen later? An example To make things a little more concrete, let’s work with a real-world example. Consider the context package’s WithDeadline function again. package context // WithDeadline returns a derived context // with a deadline no later than d. func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) There are two obvious tests to write for WithDeadline . The context is not canceled before the deadline. The context is canceled after the deadline. Let’s write a test. To keep the amount of code marginally less overwhelming, we’ll just test the second case: After the deadline expires, the context is canceled. func TestWithDeadlineAfterDeadline(t *testing.T) { deadline := time.Now().Add(1 * time.Second) ctx, _ := context.WithDeadline(t.Context(), deadline) time.Sleep(time.Until(deadline)) if err := ctx.Err(); err != context.DeadlineExceeded { t.Fatalf(\"context not canceled after deadline\") } } This test is simple: Use context.WithDeadline to create a context with a deadline one second in the future. Wait until the deadline. Verify that the context is canceled. Unfortunately, this test obviously has a problem. It sleeps until the exact moment the deadline expires. Odds are good that the context has not been canceled yet by the time we examine it. At best, this test will be very flaky. Let’s fix it. time.Sleep(time.Until(deadline) + 100*time.Millisecond) We can sleep until 100ms after the deadline. A hundred milliseconds is an eternity in computer terms. This should be fine. Unfortunately, we still have two problems. First, this test takes 1.1 seconds to execute. That’s slow. This is a simple test. It should execute in milliseconds at the most. Second, this test is flaky. A hundred milliseconds is an eternity in computer terms, but on an overloaded continuous integration (CI) system it isn’t unusual to see pauses much longer than that. This test will probably pass consistently on a developer’s workstation, but I would expect occasional failures in a CI system. Slow or flaky: Pick two Tests that use real time are always slow or flaky. Usually they’re both. If the test waits longer than necessary, it is slow. If it doesn’t wait long enough, it is flaky. You can make the test more slow and less flaky, or less slow and more flaky, but you can’t make it fast and reliable. We have a lot of tests in the net/http package which use this approach. They’re all slow and/or flaky, which is what started me down the road which brings us here today. Write synchronous functions? The simplest way to test an asynchronous function is not to do it. Synchronous functions are easy to test. If you can transform an asynchronous function into a synchronous one, it will be easier to test. For example, if we consider our cache cleanup functions from earlier, the synchronous Cleanup is obviously better than the asynchronous CleanupInBackground . The synchronous function is easier to test, and the caller can easily start a new goroutine to run it in the background if needed. As a general rule, the higher up the call stack you can push your concurrency, the better. // CleanupInBackground is hard to test. cache.CleanupInBackground() // Cleanup is easy to test, // and easy to run in the background when needed. go cache.Cleanup() Unfortunately, this sort of transformation isn’t always possible. For example, context.WithDeadline is an inherently asynchronous API. Instrument code for testability? A better approach is to make our code more testable. Here’s an example of what this might look like for our WithDeadline test: func TestWithDeadlineAfterDeadline(t *testing.T) { clock := fakeClock() timeout := 1 * time.Second deadline := clock.Now().Add(timeout) ctx, _ := context.WithDeadlineClock( t.Context(), deadline, clock) clock.Advance(timeout) context.WaitUntilIdle(ctx) if err := ctx.Err(); err != context.DeadlineExceeded { t.Fatalf(\"context not canceled after deadline\") } } Instead of using real time, we use a fake time implementation. Using fake time avoids unnecessarily slow tests, because we never wait around doing nothing. It also helps avoid test flakiness, since the current time only changes when the test adjusts it. There are various fake time packages out there, or you can write your own. To use fake time, we need to modify our API to accept a fake clock. I’ve added a context.WithDeadlineClock function here, that takes an additional clock parameter: ctx, _ := context.WithDeadlineClock( t.Context(), deadline, clock) When we advance our fake clock, we have a problem. Advancing time is an asynchrounous operation. Sleeping goroutines may wake up, timers may send on their channels, and timer functions may run. We need to wait for that work to finish before we can test the expected behavior of the system. I’ve added a context.WaitUntilIdle function here, which waits for any background work related to a context to complete: clock.Advance(timeout) context.WaitUntilIdle(ctx) This is a simple example, but it demonstrates the two fundamental principles of writing testable concurrent code: Use fake time (if you use time). Have some way to wait for quiescence, which is a fancy way of saying “all background activity has stopped and the system is stable”. The interesting question, of course, is how we do this. I’ve glossed over the details in this example because there are some big downsides to this approach. It’s hard. Using a fake clock isn’t difficult, but identifying when background concurrent work is finished and it is safe to examine the state of the system is. Your code becomes less idiomatic. You can’t use standard time package functions. You need to be very careful to keep track of everything happening in the background. You need to instrument not just your code, but any other packages you use. If you call any third-party concurrent code, you’re probably out of luck. Worst of all, it can be just about impossible to retrofit this approach into an existing codebase. I attempted to apply this approach to Go’s HTTP implementation, and while I had some success at doing so in places, the HTTP/2 server simply defeated me. In particular, adding instrumentation to detect quiescence without extensive rewriting proved infeasible, or at least beyond my skills. Horrible runtime hacks? What do we do if we can’t make our code testable? What if instead of instrumenting our code, we had a way to observe the behavior of the uninstrumented system? A Go program consists of a set of goroutines. Those goroutines have states. We just need to wait until all the goroutines have stopped running. Unfortunately, the Go runtime doesn’t provide any way to tell what those goroutines are doing. Or does it? The runtime package contains a function that gives us a stack trace for every running goroutine, as well as their states. This is text intended for human consumption, but we could parse that output. Could we use this to detect quiescence? Now, of course this is a terrible idea. There is no guarantee that the format of these stack traces will be stable over time. You should not do this. I did it. And it worked. In fact, it worked surprisingly well. With a simple implementation of a fake clock, a small amount of instrumentation to keep track of what goroutines were part of the test, and some horrifying abuse of runtime.Stack , I finally had a way to write fast, reliable tests for the http package. The underlying implementation of these tests was horrible, but it demonstrated that there was a useful concept here. A better way Go may have built-in concurrency, but testing programs that use that concurrency is hard. We’re faced with an unfortunate choice: We can write simple, idiomatic code, but it will be impossible to test quickly and reliably; or we can write testable code, but it will be complicated and unidiomatic. So we asked ourselves what we can do to make this better. As we saw earlier, the two fundamental features required to write testable concurrent code are fake time and a way to wait for quiescence. We need a better way to wait for quiescence. We should be able to ask the runtime when background goroutines have finished their work. We also want to be able to limit the scope of this query to a single test, so that unrelated tests do not interfere with each other. We also need better support for testing programs using fake time. It isn’t hard to make a fake time implementation, but code which uses an implementation like this is not idiomatic. Idiomatic code will use a time.Timer , but it is not possible to create a fake Timer . We asked ourselves whether we should provide a way for tests to create a fake Timer , where the test controls when the timer fires. A testing implementation of time needs to define an entirely new version of the time package, and pass that to every function that operates on time. We considered whether we should define a common time interface, in the same way that net.Conn is a common interface describing a network connection. What we realized, however, is that unlike network connections, there is only one possible implementation of fake time. A fake network may want to introduce latency or errors. Time, in contrast, does only one thing: It moves forward. Tests need to control the rate at which time progresses, but a timer scheduled to fire ten seconds in the future should always fire ten (possibly fake) seconds in the future. In addition, we don’t want to upset the entire Go ecosystem. Most programs today use functions in the time package. We want to keep those programs not only working, but idiomatic. This led to the conclusion that what we need is a way for a test to tell the time package to use a fake clock, in much the same way that the Go playground uses a fake clock. Unlike the playground, we need to limit the scope of that change to a single test. (It may not be obvious that the Go playground uses a fake clock, because we turn any fake delays into real delays on the front end, but it does.) The synctest experiment And so in Go 1.24 we introduced testing/synctest , a new, experimental package to simplify testing concurrent programs. Over the months following the release of Go 1.24 we gathered feedback from early adopters. (Thank you to everyone who tried it out!) We made a number of changes to address problems and shortcomings. And now, in Go 1.25, we’ve released the testing/synctest package as part of the standard library. It lets you run a function in what we’re calling a “bubble”. Within the bubble, the time package uses a fake clock, and the synctest package provides a function to wait for the bubble to quiesce. The synctest package The synctest package contains just two functions. package synctest // Test executes f in a new bubble. // Goroutines in the bubble use a fake clock. func Test(t *testing.T, f func(*testing.T)) // Wait waits for background activity in the bubble to complete. func Wait() Test executes a function in a new bubble. Wait blocks until every goroutine in the bubble is blocked waiting for some other goroutine in the bubble. We call that state being “durably blocked”. Testing with synctest Let’s look at an example of synctest in action. func TestWithDeadlineAfterDeadline(t *testing.T) { synctest.Test(t, func(t *testing.T) { deadline := time.Now().Add(1 * time.Second) ctx, _ := context.WithDeadline(t.Context(), deadline) time.Sleep(time.Until(deadline)) synctest.Wait() if err := ctx.Err(); err != context.DeadlineExceeded { t.Fatalf(\"context not canceled after deadline\") } }) } This might look a little familiar. This is the naïve test for context.WithDeadline that we looked at earlier. The only changes are that we’ve wrapped the test in a synctest.Test call to execute it in a bubble and we have added a synctest.Wait call. This test is fast and reliable. It runs almost instantaneously. It precisely tests the expected behavior of the system under test. It also requires no modification of the context package. Using the synctest package, we can write simple, idiomatic code and test it reliably. This is a very simple example, of course, but this is a real test of real production code. If synctest had existed when the context package was written, we would have had a much easier time writing tests for it. Time Time in the bubble behaves much the same as the fake time in the Go playground. Time starts at midnight, January 1, 2000 UTC. If you need to run a test at some specific point in time for some reason, you can just sleep until then. func TestAtSpecificTime(t *testing.T) { synctest.Test(t, func(t *testing.T) { // 2000-01-01 00:00:00 +0000 UTC t.Log(time.Now().In(time.UTC)) // This does not take 25 years. time.Sleep(time.Until( time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC))) // 2025-01-01 00:00:00 +0000 UTC t.Log(time.Now().In(time.UTC)) }) } Time only passes when every goroutine in the bubble has blocked. You can think of the bubble as simulating an infinitely fast computer: Any amount of computation takes no time. The following test will always print that zero seconds of fake time have elapsed since the start of the test, no matter how much real time has passed. func TestExpensiveWork(t *testing.T) { synctest.Test(t, func(t *testing.T) { start := time.Now() for range 1e7 { // do expensive work } t.Log(time.Since(start)) // 0s }) } In the next test, the time.Sleep call will return immediately, rather than waiting for ten real seconds. The test will always print that exactly ten fake seconds have passed since the start of the test. func TestSleep(t *testing.T) { synctest.Test(t, func(t *testing.T) { start := time.Now() time.Sleep(10 * time.Second) t.Log(time.Since(start)) // 10s }) } Waiting for quiescence The synctest.Wait function lets us wait for background activity to complete. func TestWait(t *testing.T) { synctest.Test(t, func(t *testing.T) { done := false go func() { done = true }() // Wait for the above goroutine to finish. synctest.Wait() t.Log(done) // true }) } If we didn’t have the Wait call in the above test, we would have a race condition: One goroutine modifies the done variable while another reads from it without synchronization. The Wait call provides that synchronization. You may be familiar with the -race test flag, which enables the data race detector. The race detector is aware of the synchronization provided by Wait , and does not complain about this test. If we forgot the Wait call, the race detector would correctly complain. The synctest.Wait function provides synchronization, but the passage of time does not. In the next example, one goroutine writes to the done variable while another sleeps for one nanosecond before reading from it. It should be obvious that when run with a real clock outside a synctest bubble, this code contains a race condition. Inside a synctest bubble, while the fake clock ensures that the goroutine completes before time.Sleep returns, the race detector will still report the data race, just like it would if this code were run outside a synctest bubble. func TestTimeDataRace(t *testing.T) { synctest.Test(t, func(t *testing.T) { done := false go func() { done = true // write }() time.Sleep(1 * time.Nanosecond) t.Log(done) // read (unsynchronized) }) } Adding a Wait call provides explicit synchronization and fixes the data race: time.Sleep(1 * time.Nanosecond) synctest.Wait() // synchronize t.Log(done) // read Example: io.Copy Taking advantage of the synchronization provided by synctest.Wait allows us to write simpler tests with less explicit synchronization. For example, consider this test of io.Copy . func TestIOCopy(t *testing.T) { synctest.Test(t, func(t *testing.T) { srcReader, srcWriter := io.Pipe() defer srcWriter.Close() var dst bytes.Buffer go io.Copy(&dst, srcReader) data := \"1234\" srcWriter.Write([]byte(\"1234\")) synctest.Wait() if got, want := dst.String(), data; got != want { t.Errorf(\"Copy wrote %q, want %q\", got, want) } }) } The io.Copy function copies data from an io.Reader to an io.Writer . You might not immediately think of io.Copy as a concurrent function, since it blocks until the copy has completed. However, providing data to io.Copy ’s reader is an asynchronous operation: Copy calls the reader’s Read method; Read returns some data; and the data is written to the writer at a later time. In this test, we are verifying that io.Copy writes new data to the writer without waiting to fill its buffer. Looking at the test step by step, we first create an io.Pipe to serve as the source io.Copy reads from: srcReader, srcWriter := io.Pipe() defer srcWriter.Close() We call io.Copy in a new goroutine, copying from the read end of the pipe into a bytes.Buffer : var dst bytes.Buffer go io.Copy(&dst, srcReader) We write to the other end of the pipe, and wait for io.Copy to handle the data: data := \"1234\" srcWriter.Write([]byte(\"1234\")) synctest.Wait() Finally, we verify that the destination buffer contains the desired data: if got, want := dst.String(), data; got != want { t.Errorf(\"Copy wrote %q, want %q\", got, want) } We don’t need to add a mutex or other synchronization around the destination buffer, because synctest.Wait ensures that it is never accessed concurrently. This test demonstrates a few important points. Even synchronous functions like io.Copy , which do not perform additional background work after they return, may exhibit asynchronous behaviors. Using synctest.Wait , we can test those behaviors. Note also that this test does not work with time. Many asynchronous systems involve time, but not all. Bubble exit The synctest.Test function waits for all goroutines in the bubble to exit before returning. Time stops advancing after the root goroutine (the goroutine started by Test ) returns. In the next example, Test waits for the background goroutine to run and exit before it returns: func TestWaitForGoroutine(t *testing.T) { synctest.Test(t, func(t *testing.T) { go func() { // This runs before synctest.Test returns. }() }) } In this example, we schedule a time.AfterFunc for a time in the future. The bubble’s root goroutine returns before that time is reached, so the AfterFunc never runs: func TestDoNotWaitForTimer(t *testing.T) { synctest.Test(t, func(t *testing.T) { time.AfterFunc(1 * time.Nanosecond, func() { // This never runs. }) }) } In the next example, we start a goroutine that sleeps. The root goroutine returns and time stops advancing. The bubble is now deadlocked, because Test is waiting for all goroutines in the bubble to finish but the sleeping goroutine is waiting for time to advance. func TestDeadlock(t *testing.T) { synctest.Test(t, func(t *testing.T) { go func() { // This sleep never returns and the test deadlocks. time.Sleep(1 * time.Nanosecond) }() }) } Deadlocks The synctest package panics when a bubble is deadlocked due to every goroutine in the bubble being durably blocked on another goroutine in the bubble. --- FAIL: Test (0.00s) --- FAIL: TestDeadlock (0.00s) panic: deadlock: main bubble goroutine has exited but blocked goroutines remain [recovered, repanicked] goroutine 7 [running]: (stacks elided for clarity) goroutine 10 [sleep (durable), synctest bubble 1]: time.Sleep(0x1) /Users/dneil/src/go/src/runtime/time.go:361 +0x130 _.TestDeadlock.func1.1() /tmp/s/main_test.go:13 +0x20 created by _.TestDeadlock.func1 in goroutine 9 /tmp/s/main_test.go:11 +0x24 FAIL _ 0.173s FAIL The runtime will print stack traces for every goroutine in the deadlocked bubble. When printing the status of a bubbled goroutine, the runtime indicates when the goroutine is durably blocked. You can see that the sleeping goroutine in this test is durably blocked. Durable blocking “Durably blocking” is a core concept in synctest. A goroutine is durably blocked when it is not only blocked, but when it can only be unblocked by another goroutine in the same bubble. When every goroutine in a bubble is durably blocked: synctest.Wait returns. If there is no synctest.Wait call in progress, fake time advances instantly to the next point that will wake a goroutine. If there is no goroutine that can be woken by advancing time, the bubble is deadlocked and the test fails. It is important for us to make a distinction between a goroutine which is merely blocked and one which is durably blocked. We don’t want to declare a deadlock when a goroutine is temporarily blocked on some event arising outside its bubble. Let’s look at some ways in which a goroutine can block non-durably. Not durably blocking: I/O (files, pipes, network connections, etc.) The most important limitation is that I/O is not durably blocking, including network I/O. A goroutine reading from a network connection may be blocked, but it will be unblocked by data arriving on that connection. This is obviously true for a connection to some network service, but it is also true for a loopback connection, even when the reader and writer are both in the same bubble. When we write data to a network socket, even a loopback socket, the data is passed to the kernel for delivery. There is a period of time between the write system call returning and the kernel notifying the other side of the connection that data is available. The Go runtime cannot distinguish between a goroutine blocked waiting for data that is already in the kernel’s buffers and one blocked waiting for data that will not arrive. This means that tests of networked programs using synctest usually cannot use real network connections. Instead, they should use an in-memory fake. I’m not going to go over the process of creating a fake network here, but the synctest package documentation contains a complete worked example of testing an HTTP client and server communicating over a fake network. Not durably blocking: syscalls, cgo calls, anything that isn’t Go Syscalls and cgo calls are not durably blocking. We can only reason about the state of goroutines executing Go code. Not durably blocking: Mutexes Perhaps surprisingly, mutexes are not durably blocking. This is a decision born of practicality: Mutexes are often used to guard global state, so a bubbled goroutine will often need to acquire a mutex held outside its bubble. Mutexes are highly performance-sensitive, so adding additional instrumentation to them risks slowing down non-test programs. We can test programs that use mutexes with synctest, but the fake clock will not advance while a goroutine is blocked on mutex acquisition. This hasn’t posed a problem in any case we’ve encountered, but it is something to be aware of. Durably blocking: time.Sleep So what is durably blocking? time.Sleep is obviously durable, since time can only advance when every goroutine in the bubble is durably blocked. Durably blocking: send or receive on channels created in the same bubble Channel operations on channels created within the same bubble are durable. We make a distinction between bubbled channels (created in a bubble) and unbubbled channels (created outside any bubble). This means that a function using a global channel for synchronization, for example to control access to a globally cached resource, can be safely called from within a bubble. Trying to operate on a bubbled channel from outside its bubble is an error. Durably blocking: sync.WaitGroup belonging to the same bubble We also associate sync.WaitGroup s with bubbles. WaitGroup doesn’t have a constructor, so we make the association with the bubble implicitly on the first call to Go or Add . As with channels, waiting on a WaitGroup belonging to the same bubble is durably blocking, and waiting on one from outside the bubble is not. Calling Go or Add on a WaitGroup belonging to a different bubble is an error. Durably blocking: sync.Cond.Wait Waiting on a sync.Cond is always durably blocking. Waking up a goroutine waiting on a Cond in a different bubble is an error. Durably blocking: select{} Finally, an empty select is durably blocking. (A select with cases is durably blocking if all the operations in it are so.) That’s the complete list of durably blocking operations. It isn’t very long, but it’s enough to handle almost all real-world programs. The rule is that a goroutine is durably blocked when it is blocked, and we can guarantee that it can only be unblocked by another goroutine in its bubble. In cases where it is possible to attempt to wake a bubbled goroutine from outside its bubble, we panic. For example, it is an error to operate on a bubbled channel from outside its bubble. Changes from 1.24 to 1.25 We released an experimental version of the synctest package in Go 1.24. To ensure that early adopters were aware of the experimental status of the package, you needed to set a GOEXPERIMENT flag to make the package visible. The feedback we received from those early adopters was invaluable, both in demonstrating that the package is useful and in uncovering areas where the API needed work. These are some of the changes made between the experimental version and the version released in Go 1.25. Replaced Run with Test The original version of the API created a bubble with a Run function: // Run executes f in a new bubble. func Run(f func()) It became clear that we needed a way to create a *testing.T that is scoped to a bubble. For example, t.Cleanup should run cleanup functions in the same bubble they are registered in, not after the bubble exits. We renamed Run to Test and made it create a T scoped to the lifetime of the new bubble. Time stops when a bubble’s root goroutine returns We originally continued to advance time within a bubble for so long as the bubble contained any goroutines waiting for future events. This turned out to be very confusing when a long-lived goroutine never returned, such as a goroutine reading forever from a time.Ticker . We now stop advancing time when a bubble’s root goroutine returns. If the bubble is blocked waiting for time to advance, this results in a deadlock and a panic which can be analyzed. Removed cases where “durable” wasn’t We cleaned up the definition of “durably blocking”. The original implementation had cases where a durably blocked goroutine could be unblocked from outside the bubble. For example, channels recorded whether they were created in a bubble, but not which in which bubble they were created, so one bubble could unblock a channel in a different bubble. The current implementation contains no cases we know of where a durably blocked goroutine can be unblocked from outside its bubble. Better stack traces We made improvements to the information printed in stack traces. When a bubble deadlocks, we by default now only print stacks for the goroutines in that bubble. Stack traces also clearly indicate which goroutines in a bubble are durably blocked. Randomized events happening at the same time We made improvements to the randomization of events happening at the same time. Originally, timers scheduled to fire at the same instant would always do so in the order they were created. This ordering is now randomized. Future work We’re pretty happy with the synctest package at the moment. Aside from the inevitable bug fixes, we don’t currently expect any major changes to it in the future. Of course, with wider adoption it is always possible that we’ll discover something that needs doing. One possible area of work is to improve the detection of durably blocked goroutines. It would be nice if we could make mutex operations durably blocking, with a restriction that a mutex acquired in a bubble must be released from within the same bubble. Testing networked code with synctest requires a fake network. The net.Pipe function can create a fake net.Conn , but there is currently no standard library function that creates a fake net.Listener or net.PacketConn . In addition, the net.Conn returned by net.Pipe is synchronous–every write blocks until a read consumes the data–which is not representative of real network behavior. Perhaps we should add a good fake implementations of common network interfaces to the standard library. Conclusion That’s the synctest package. I can’t say that it makes testing concurrent code simple, because concurrency is never simple. What it does is let you write the simplest possible concurrent code, using idiomatic Go, and the standard time package, and then write fast, reliable tests for it. I hope you find it useful.",
+    "quality_score": 9,
+    "modules": [
+      "go_patterns",
+      "testing",
+      "concurrency"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/slog",
+    "title": "Structured Logging with slog",
+    "source_name": "The Go Blog",
+    "text": "The new log/slog package in Go 1.21 brings structured logging to the standard library. Structured logs use key-value pairs so they can be parsed, filtered, searched, and analyzed quickly and reliably. For servers, logging is an important way for developers to observe the detailed behavior of the system, and often the first place they go to debug it. Logs therefore tend to be voluminous, and the ability to search and filter them quickly is essential. The standard library has had a logging package, log , since Go’s initial release over a decade ago. Over time, we’ve learned that structured logging is important to Go programmers. It has consistently ranked high in our annual survey, and many packages in the Go ecosystem provide it. Some of these are quite popular: one of the first structured logging packages for Go, logrus , is used in over 100,000 other packages. With many structured logging packages to choose from, large programs will often end up including more than one through their dependencies. The main program might have to configure each of these logging packages so that the log output is consistent: it all goes to the same place, in the same format. By including structured logging in the standard library, we can provide a common framework that all the other structured logging packages can share. A tour of slog Here is the simplest program that uses slog : package main import \"log/slog\" func main() { slog.Info(\"hello, world\") } As of this writing, it prints: 2023/08/04 16:09:19 INFO hello, world The Info function prints a message at the Info log level using the default logger, which in this case is the default logger from the log package—the same logger you get when you write log.Printf . That explains why the output looks so similar: only the “INFO” is new. Out of the box, slog and the original log package work together to make it easy to get started. Besides Info , there are functions for three other levels— Debug , Warn , and Error —as well as a more general Log function that takes the level as an argument. In slog , levels are just integers, so you aren’t limited to the four named levels. For example, Info is zero and Warn is 4, so if your logging system has a level in between those, you can use 2 for it. Unlike with the log package, we can easily add key-value pairs to our output by writing them after the message: slog.Info(\"hello, world\", \"user\", os.Getenv(\"USER\")) The output now looks like this: 2023/08/04 16:27:19 INFO hello, world user=jba As we mentioned, slog ’s top-level functions use the default logger. We can get this logger explicitly, and call its methods: logger := slog.Default() logger.Info(\"hello, world\", \"user\", os.Getenv(\"USER\")) Every top-level function corresponds to a method on a slog.Logger . The output is the same as before. Initially, slog’s output goes through the default log.Logger , producing the output we’ve seen above. We can change the output by changing the handler used by the logger. slog comes with two built-in handlers. A TextHandler emits all log information in the form key=value . This program creates a new logger using a TextHandler and makes the same call to the Info method: logger := slog.New(slog.NewTextHandler(os.Stdout, nil)) logger.Info(\"hello, world\", \"user\", os.Getenv(\"USER\")) Now the output looks like this: time=2023-08-04T16:56:03.786-04:00 level=INFO msg=\"hello, world\" user=jba Everything has been turned into a key-value pair, with strings quoted as needed to preserve structure. For JSON output, install the built-in JSONHandler instead: logger := slog.New(slog.NewJSONHandler(os.Stdout, nil)) logger.Info(\"hello, world\", \"user\", os.Getenv(\"USER\")) Now our output is a sequence of JSON objects, one per logging call: {\"time\":\"2023-08-04T16:58:02.939245411-04:00\",\"level\":\"INFO\",\"msg\":\"hello, world\",\"user\":\"jba\"} You are not limited to the built-in handlers. Anyone can write a handler by implementing the slog.Handler interface. A handler can generate output in a particular format, or it can wrap another handler to add functionality. One of the examples in the slog documentation shows how to write a wrapping handler that changes the minimum level at which log messages will be displayed. The alternating key-value syntax for attributes that we’ve been using so far is convenient, but for frequently executed log statements it may be more efficient to use the Attr type and call the LogAttrs method. These work together to minimize memory allocations. There are functions for building Attr s out of strings, numbers, and other common types. This call to LogAttrs produces the same output as above, but does it faster: slog.LogAttrs(context.Background(), slog.LevelInfo, \"hello, world\", slog.String(\"user\", os.Getenv(\"USER\"))) There is a lot more to slog : As the call to LogAttrs shows, you can pass a context.Context to some log functions so a handler can extract context information like trace IDs. (Canceling the context does not prevent the log entry from being written.) You can call Logger.With to add attributes to a logger that will appear in all of its output, effectively factoring out the common parts of several log statements. This is not only convenient, but it can also help performance, as discussed below. Attributes can be combined into groups. This can add more structure to your log output and can help to disambiguate keys that would otherwise be identical. You can control how a value appears in the logs by providing its type with a LogValue method. That can be used to log the fields of a struct as a group or redact sensitive data , among other things. The best place to learn about all of slog is the package documentation . Performance We wanted slog to be fast. For large-scale performance gains, we designed the Handler interface to provide optimization opportunities. The Enabled method is called at the beginning of every log event, giving the handler a chance to drop unwanted log events quickly. The WithAttrs and WithGroup methods let the handler format attributes added by Logger.With once, rather than at each logging call. This pre-formatting can provide a significant speedup when large attributes, like an http.Request , are added to a Logger and then used in many logging calls. To inform our performance optimization work, we investigated typical patterns of logging in existing open-source projects. We found that over 95% of calls to logging methods pass five or fewer attributes. We also categorized the types of attributes, finding that a handful of common types accounted for the majority. We then wrote benchmarks that captured the common cases, and used them as a guide to see where the time went. The greatest gains came from paying careful attention to memory allocation. The design process The slog package is one of the largest additions to the standard library since Go 1 was released in 2012. We wanted to take our time designing it, and we knew that community feedback would be essential. By April 2022, we had gathered enough data to demonstrate the importance of structured logging to the Go community. The Go team decided to explore adding it to the standard library. We began by looking at how the existing structured logging packages were designed. We also took advantage of the large collection of open-source Go code stored on the Go module proxy to learn how these packages were actually used. Our first design was informed by this research as well as Go’s spirit of simplicity. We wanted an API that is light on the page and easy to understand, without sacrificing performance. It was never a goal to replace existing third-party logging packages. They are all good at what they do, and replacing existing code that works well is rarely a good use of a developer’s time. We divided the API into a frontend, Logger , that calls a backend interface, Handler . That way, existing logging packages can talk to a common backend, so the packages that use them can interoperate without having to be rewritten. Handlers are written or in progress for many common logging packages, including Zap , logr and hclog . We shared our initial design within the Go team and other developers who had extensive logging experience. We made alterations based on their feedback, and by August of 2022 we felt we had a workable design. On August 29, we made our experimental implementation public and began a GitHub discussion to hear what the community had to say. The response was enthusiastic and largely positive. Thanks to insightful comments from the designers and users of other structured logging packages, we made several changes and added a few features, like groups and the LogValuer interface. We changed the mapping from log levels to integers twice. After two months and about 300 comments, we felt we were ready for an actual proposal and accompanying design doc . The proposal issue garnered over 800 comments and resulted in many improvements to the API and the implementation. Here are two examples of API changes, both concerning context.Context : Originally the API supported adding loggers to a context. Many felt that this was a convenient way to plumb a logger easily through levels of code that didn’t care about it. But others felt it was smuggling in an implicit dependency, making the code harder to understand. Ultimately, we removed the feature as being too controversial. We also wrestled with the related question of passing a context to logging methods, trying a number of designs. We initially resisted the standard pattern of passing the context as the first argument because we didn’t want every logging call to require a context, but ultimately created two sets of logging methods, one with a context and one without. One change we did not make concerned the alternating key-and-value syntax for expressing attributes: slog.Info(\"message\", \"k1\", v1, \"k2\", v2) Many felt strongly that this was a bad idea. They found it hard to read and easy to get wrong by omitting a key or value. They preferred explicit attributes for expressing structure: slog.Info(\"message\", slog.Int(\"k1\", v1), slog.String(\"k2\", v2)) But we felt that the lighter syntax was important to keeping Go easy and fun to use, especially for new Go programmers. We also knew that several Go logging packages, like logr , go-kit/log and zap (with its SugaredLogger ) successfully used alternating keys and values. We added a vet check to catch common mistakes, but did not change the design. On March 15, 2023, the proposal was accepted, but there were still some minor unresolved issues. Over the next few weeks, ten additional changes were proposed and resolved. By early July, the log/slog package implementation was complete, along with the testing/slogtest package for verifying handlers and the vet check for correct usage of alternating keys and values. And on August 8, Go 1.21 was released, and slog with it. We hope you find it useful, and as fun to use as it was to build. And a big thanks to everyone who participated in the discussion and the proposal process. Your contributions improved slog immensely. Resources The documentation for the log/slog package explains how to use it and provides several examples. The wiki page has additional resources provided by the Go community, including a variety of handlers. If you want to write a handler, consult the handler writing guide .",
+    "quality_score": 8,
+    "modules": [
+      "go_patterns",
+      "observability",
+      "api_design"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/range-functions",
+    "title": "Range Over Function Types",
+    "source_name": "The Go Blog",
+    "text": "Introduction This is the blog post version of my talk at GopherCon 2024. Range over function types is a new language feature in the Go 1.23 release. This blog post will explain why we are adding this new feature, what exactly it is, and how to use it. Why? Since Go 1.18 we’ve had the ability to write new generic container types in Go. For example, let’s consider this very simple Set type, a generic type implemented on top of a map. // Set holds a set of elements. type Set[E comparable] struct { m map[E]struct{} } // New returns a new [Set]. func New[E comparable]() *Set[E] { return &Set[E]{m: make(map[E]struct{})} } Naturally a set type has a way to add elements and a way to check whether elements are present. The details here don’t matter. // Add adds an element to a set. func (s *Set[E]) Add(v E) { s.m[v] = struct{}{} } // Contains reports whether an element is in a set. func (s *Set[E]) Contains(v E) bool { _, ok := s.m[v] return ok } And among other things we will want a function to return the union of two sets. // Union returns the union of two sets. func Union[E comparable](s1, s2 *Set[E]) *Set[E] { r := New[E]() // Note for/range over internal Set field m. // We are looping over the maps in s1 and s2. for v := range s1.m { r.Add(v) } for v := range s2.m { r.Add(v) } return r } Let’s look at this implementation of the Union function for a minute. In order to compute the union of two sets, we need a way to get all the elements that are in each set. In this code we use a for/range statement over an unexported field of the set type. That only works if the Union function is defined in the set package. But there are a lot of reasons why someone might want to loop over all the elements in a set. This set package has to provide some way for its users to do that. How should that work? Push Set elements One approach is to provide a Set method that takes a function, and to call that function with every element in the Set. We’ll call this Push , because the Set pushes every value to the function. Here if the function returns false, we stop calling it. func (s *Set[E]) Push(f func(E) bool) { for v := range s.m { if !f(v) { return } } } In the Go standard library, we see this general pattern used for cases like the sync.Map.Range method, the flag.Visit function, and the filepath.Walk function. This is a general pattern, not an exact one; as it happens, none of those three examples work quite the same way. This is what it looks like to use the Push method to print all the elements of a set: you call Push with a function that does what you want with the element. func PrintAllElementsPush[E comparable](s *Set[E]) { s.Push(func(v E) bool { fmt.Println(v) return true }) } Pull Set elements Another approach to looping over the elements of a Set is to return a function. Each time the function is called, it will return a value from the Set , along with a boolean that reports whether the value is valid. The boolean result will be false when the loop has gone through all the elements. In this case we also need a stop function that can be called when no more values are needed. This implementation uses a pair of channels, one for values in the set and one to stop returning values. We use a goroutine to send values on the channel. The next function returns an element from the set by reading from the element channel, and the stop function tells the goroutine to exit by closing the stop channel. We need the stop function to make sure that the goroutine exits when no more values are needed. // Pull returns a next function that returns each // element of s with a bool for whether the value // is valid. The stop function should be called // when finished calling the next function. func (s *Set[E]) Pull() (func() (E, bool), func()) { ch := make(chan E) stopCh := make(chan bool) go func() { defer close(ch) for v := range s.m { select { case ch <- v: case <-stopCh: return } } }() next := func() (E, bool) { v, ok := <-ch return v, ok } stop := func() { close(stopCh) } return next, stop } Nothing in the standard library works exactly this way. Both runtime.CallersFrames and reflect.Value.MapRange are similar, though they return values with methods rather than returning functions directly. This is what it looks like to use the Pull method to print all the elements of a Set . You call Pull to get a function, and you repeatedly call that function in a for loop. func PrintAllElementsPull[E comparable](s *Set[E]) { next, stop := s.Pull() defer stop() for v, ok := next(); ok; v, ok = next() { fmt.Println(v) } } Standardize the approach We’ve now seen two different approaches to looping over all the elements of a set. Different Go packages use these approaches and several others. That means that when you start using a new Go container package you may have to learn a new looping mechanism. It also means that we can’t write one function that works with several different types of containers, as the container types will handle looping differently. We want to improve the Go ecosystem by developing standard approaches for looping over containers. Iterators This is, of course, an issue that arises in many programming languages. The popular Design Patterns book , first published in 1994, describes this as the iterator pattern. You use an iterator to “provide a way to access the elements of an aggregate object sequentially without exposing its underlying representation.” What this quote calls an aggregate object is what I’ve been calling a container. An aggregate object, or container, is just a value that holds other values, like the Set type we’ve been discussing. Like many ideas in programming, iterators date back to Barbara Liskov’s CLU language , developed in the 1970’s. Today many popular languages provide iterators one way or another, including, among others, C++, Java, Javascript, Python, and Rust. However, Go before version 1.23 did not. For/range As we all know, Go has container types that are built in to the language: slices, arrays, and maps. And it has a way to access the elements of those values without exposing the underlying representation: the for/range statement. The for/range statement works for Go’s built-in container types (and also for strings, channels, and, as of Go 1.22, int). The for/range statement is iteration, but it is not iterators as they appear in today’s popular languages. Still, it would be nice to be able to use for/range to iterate over a user-defined container like the Set type. However, Go before version 1.23 did not support this. Improvements in this release For Go 1.23 we’ve decided to support both for/range over user-defined container types, and a standardized form of iterators. We extended the for/range statement to support ranging over function types. We’ll see below how this helps loop over user-defined containers. We also added standard library types and functions to support using function types as iterators. A standard definition of iterators lets us write functions that work smoothly with different container types. Range over (some) function types The improved for/range statement doesn’t support arbitrary function types. As of Go 1.23 it now supports ranging over functions that take a single argument. The single argument must itself be a function that takes zero to two arguments and returns a bool; by convention, we call it the yield function. func(yield func() bool) func(yield func(V) bool) func(yield func(K, V) bool) When we speak of an iterator in Go, we mean a function with one of these three types. As we’ll discuss below, there is another kind of iterator in the standard library: a pull iterator. When it is necessary to distinguish between standard iterators and pull iterators, we call the standard iterators push iterators. That is because, as we will see, they push out a sequence of values by calling a yield function. Standard (push) iterators To make iterators easier to use, the new standard library package iter defines two types: Seq and Seq2 . These are names for the iterator function types, the types that can be used with the for/range statement. The name Seq is short for sequence, as iterators loop through a sequence of values. package iter type Seq[V any] func(yield func(V) bool) type Seq2[K, V any] func(yield func(K, V) bool) // for now, no Seq0 The difference between Seq and Seq2 is just that Seq2 is a sequence of pairs, such as a key and a value from a map. In this post we’ll focus on Seq for simplicity, but most of what we say covers Seq2 as well. It’s easiest to explain how iterators work with an example. Here the Set method All returns a function. The return type of All is iter.Seq[E] , so we know that it returns an iterator. // All is an iterator over the elements of s. func (s *Set[E]) All() iter.Seq[E] { return func(yield func(E) bool) { for v := range s.m { if !yield(v) { return } } } } The iterator function itself takes another function, the yield function, as an argument. The iterator calls the yield function with every value in the set. In this case the iterator, the function returned by Set.All , is a lot like the Set.Push function we saw earlier. This shows how iterators work: for some sequence of values, they call a yield function with each value in the sequence. If the yield function returns false, no more values are needed, and the iterator can just return, doing any cleanup that may be required. If the yield function never returns false, the iterator can just return after calling yield with all the values in the sequence. That’s how they work, but let’s acknowledge that the first time you see one of these, your first reaction is probably “there are a lot of functions flying around here.” You’re not wrong about that. Let’s focus on two things. The first is that once you get past the first line of this function’s code, the actual implementation of the iterator is pretty simple: call yield with every element of the set, stopping if yield returns false. for v := range s.m { if !yield(v) { return } } The second is that using this is really easy. You call s.All to get an iterator, and then you use for/range to loop over all the elements in s . The for/range statement supports any iterator, and this shows how easy that is to use. func PrintAllElements[E comparable](s *Set[E]) { for v := range s.All() { fmt.Println(v) } } In this kind of code s.All is a method that returns a function. We are calling s.All , and then using for/range to range over the function that it returns. In this case we could have made Set.All be an iterator function itself, rather than having it return an iterator function. However, in some cases that won’t work, such as if the function that returns the iterator needs to take an argument, or needs to do some set up work. As a matter of convention, we encourage all container types to provide an All method that returns an iterator, so that programmers don’t have to remember whether to range over All directly or whether to call All to get a value they can range over. They can always do the latter. If you think about it, you’ll see that the compiler must be adjusting the loop to create a yield function to pass to the iterator returned by s.All . There’s a fair bit of complexity in the Go compiler and runtime to make this efficient, and to correctly handle things like break or panic in the loop. We’re not going to cover any of that in this blog post. Fortunately the implementation details are not important when it comes to actually using this feature. Pull iterators We’ve now seen how to use iterators in a for/range loop. But a simple loop is not the only way to use an iterator. For example, sometimes we may need to iterate over two containers in parallel. How do we do that? The answer is that we use a different kind of iterator: a pull iterator. We’ve seen that a standard iterator, also known as a push iterator, is a function that takes a yield function as an argument and pushes each value in a sequence by calling the yield function. A pull iterator works the other way around: it is a function that is written such that each time you call it, it returns the next value in the sequence. We’ll repeat the difference between the two types of iterators to help you remember: A push iterator pushes each value in a sequence to a yield function. Push iterators are standard iterators in the Go standard library, and are supported directly by the for/range statement. A pull iterator works the other way around. Each time you call a pull iterator, it pulls another value from a sequence and returns it. Pull iterators are not supported directly by the for/range statement; however, it’s straightforward to write an ordinary for statement that loops through a pull iterator. In fact, we saw an example earlier when we looked at using the Set.Pull method. You could write a pull iterator yourself, but normally you don’t have to. The new standard library function iter.Pull takes a standard iterator, that is to say a function that is a push iterator, and returns a pair of functions. The first is a pull iterator: a function that returns the next value in the sequence each time it is called. The second is a stop function that should be called when we are done with the pull iterator. This is like the Set.Pull method we saw earlier. The first function returned by iter.Pull , the pull iterator, returns a value and a boolean that reports whether that value is valid. The boolean will be false at the end of the sequence. iter.Pull returns a stop function in case we don’t read through the sequence to the end. In the general case the push iterator, the argument to iter.Pull , may start goroutines, or build new data structures that need to be cleaned up when iteration is complete. The push iterator will do any cleanup when the yield function returns false, meaning that no more values are required. When used with a for/range statement, the for/range statement will ensure that if the loop exits early, through a break statement or for any other reason, then the yield function will return false. With a pull iterator, on the other hand, there is no way to force the yield function to return false, so the stop function is needed. Another way to say this is that calling the stop function will cause the yield function to return false when it is called by the push iterator. Strictly speaking you don’t need to call the stop function if the pull iterator returns false to indicate that it has reached the end of the sequence, but it’s usually simpler to just always call it. Here is an example of using pull iterators to walk through two sequences in parallel. This function reports whether two arbitrary sequences contain the same elements in the same order. // EqSeq reports whether two iterators contain the same // elements in the same order. func EqSeq[E comparable](s1, s2 iter.Seq[E]) bool { next1, stop1 := iter.Pull(s1) defer stop1() next2, stop2 := iter.Pull(s2) defer stop2() for { v1, ok1 := next1() v2, ok2 := next2() if !ok1 { return !ok2 } if ok1 != ok2 || v1 != v2 { return false } } } The function uses iter.Pull to convert the two push iterators, s1 and s2 , into pull iterators. It uses defer statements to make sure that the pull iterators are stopped when we are done with them. Then the code loops, calling the pull iterators to retrieve values. If the first sequence is done, it returns true if the second sequence is also done, or false if it isn’t. If the values are different, it returns false. Then it loops to pull the next two values. As with push iterators, there is some complexity in the Go runtime to make pull iterators efficient, but this does not affect code that actually uses the iter.Pull function. Iterating on iterators Now you know everything there is to know about range over function types and about iterators. We hope you enjoy using them! Still, there are a few more things worth mentioning. Adapters An advantage of a standard definition of iterators is the ability to write standard adapter functions that use them. For example, here is a function that filters a sequence of values, returning a new sequence. This Filter function takes an iterator as an argument and returns a new iterator. The other argument is a filter function that decides which values should be in the new iterator that Filter returns. // Filter returns a sequence that contains the elements // of s for which f returns true. func Filter[V any](f func(V) bool, s iter.Seq[V]) iter.Seq[V] { return func(yield func(V) bool) { for v := range s { if f(v) { if !yield(v) { return } } } } } As with the earlier example, the function signatures look complicated when you first see them. Once you get past the signatures, the implementation is straightforward. for v := range s { if f(v) { if !yield(v) { return } } } The code ranges over the input iterator, checks the filter function, and calls yield with the values that should go into the output iterator. We’ll show an example of using Filter below. (There is no version of Filter in the Go standard library today, but one may be added in future releases.) Binary tree As an example of how convenient a push iterator can be to loop over a container type, let’s consider this simple binary tree type. // Tree is a binary tree. type Tree[E any] struct { val E left, right *Tree[E] } We won’t show the code to insert values into the tree, but naturally there should be some way to range over all the values in the tree. It turns out that the iterator code is easier to write if it returns a bool. Since the function types supported by for/range don’t return anything, the All method here returns a small function literal that calls the iterator itself, here called push , and ignores the bool result. // All returns an iterator over the values in t. func (t *Tree[E]) All() iter.Seq[E] { return func(yield func(E) bool) { t.push(yield) } } // push pushes all elements to the yield function. func (t *Tree[E]) push(yield func(E) bool) bool { if t == nil { return true } return t.left.push(yield) && yield(t.val) && t.right.push(yield) } The push method uses recursion to walk over the whole tree, calling yield on each element. If the yield function returns false, the method returns false all the way up the stack. Otherwise it just returns once the iteration is complete. This shows how straightforward it is to use this iterator approach to loop over even complex data structures. There is no need to maintain a separate stack to record the position within the tree; we can just use the goroutine call stack to do that for us. New iterator functions. Also new in Go 1.23 are functions in the slices and maps packages that work with iterators. Here are the new functions in the slices package. All and Values are functions that return iterators over the elements of a slice. Collect fetches the values out of an iterator and returns a slice holding those values. See the docs for the others. All([]E) iter.Seq2[int, E] Values([]E) iter.Seq[E] Collect(iter.Seq[E]) []E AppendSeq([]E, iter.Seq[E]) []E Backward([]E) iter.Seq2[int, E] Sorted(iter.Seq[E]) []E SortedFunc(iter.Seq[E], func(E, E) int) []E SortedStableFunc(iter.Seq[E], func(E, E) int) []E Repeat([]E, int) []E Chunk([]E, int) iter.Seq([]E) Here are the new functions in the maps package. All , Keys , and Values returns iterators over the map contents. Collect fetches the keys and values out of an iterator and returns a new map. All(map[K]V) iter.Seq2[K, V] Keys(map[K]V) iter.Seq[K] Values(map[K]V) iter.Seq[V] Collect(iter.Seq2[K, V]) map[K, V] Insert(map[K, V], iter.Seq2[K, V]) Standard library iterator example Here is an example of how you might use these new functions along with the Filter function we saw earlier. This function takes a map from int to string and returns a slice holding just the values in the map that are longer than some argument n . // LongStrings returns a slice of just the values // in m whose length is n or more. func LongStrings(m map[int]string, n int) []string { isLong := func(s string) bool { return len(s) >= n } return slices.Collect(Filter(isLong, maps.Values(m))) } The maps.Values function returns an iterator over the values in m . Filter reads that iterator and returns a new iterator that only contains the long strings. slices.Collect reads from that iterator into a new slice. Of course, you could write a loop to do this easily enough, and in many cases a loop will be clearer. We don’t want to encourage everybody to write code in this style all the time. That said, the advantage of using iterators is that this kind of function works the same way with any sequence. In this example, notice how Filter is using a map as an input and a slice as an output, without having to change the code in Filter at all. Looping over lines in a file Although most of the examples we’ve seen have involved containers, iterators are flexible. Consider this simple code, which doesn’t use iterators, to loop over the lines in a byte slice. This is easy to write and fairly efficient. nl := []byte{'\\n'} // Trim a trailing newline to avoid a final empty blank line. for _, line := range bytes.Split(bytes.TrimSuffix(data, nl), nl) { handleLine(line) } However, bytes.Split does allocate and return a slice of byte slices to hold the lines. The garbage collector will have to do a bit of work to eventually free that slice. Here is a function that returns an iterator over the lines of some byte slice. After the usual iterator signatures, the function is pretty simple. We keep picking lines out of data until there is nothing left, and we pass each line to the yield function. // Lines returns an iterator over lines in data. func Lines(data []byte) iter.Seq[[]byte] { return func(yield func([]byte) bool) { for len(data) > 0 { line, rest, _ := bytes.Cut(data, []byte{'\\n'}) if !yield(line) { return } data = rest } } } Now our code to loop over the lines of a byte slice looks like this. for line := range Lines(data) { handleLine(line) } This is just as easy to write as the earlier code, and is a bit more efficient because it doesn’t have allocate a slice of lines. Passing a function to a push iterator For our final example, we’ll see that you don’t have to use a push iterator in a range statement. Earlier we saw a PrintAllElements function that prints out each element of a set. Here is another way to print all the elements of a set: call s.All to get an iterator, then pass in a hand-written yield function. This yield function just prints a value and returns true. Note that there are two function calls here: we call s.All to get an iterator which is itself a function, and we call that function with our hand-written yield function. func PrintAllElements[E comparable](s *Set[E]) { s.All()(func(v E) bool { fmt.Println(v) return true }) } There’s no particular reason to write this code this way. This is just an example to show that the yield function isn’t magic. It can be any function you like. Update go.mod A final note: every Go module specifies the language version that it uses. That means that in order to use new language features in an existing module you may need to update that version. This is true for all new language features; it’s not something specific to range over function types. As range over function types is new in the Go 1.23 release, using it requires specifying at least Go language version 1.23. There are (at least) four ways to set the language version: On the command line, run go get go@1.23 (or go mod edit -go=1.23 to only edit the go directive). Manually edit the go.mod file and change the go line. Keep the older language version for the module as a whole, but use a //go:build go1.23 build tag to permit using range over function types in a specific file.",
+    "quality_score": 8,
+    "modules": [
+      "go_patterns",
+      "evolutionary",
+      "api_design"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2024/12/05/react-19",
+    "title": "React v19",
+    "source_name": "React Blog",
+    "text": "December 05, 2024 by The React Team Note React 19 is now stable! Additions since this post was originally shared with the React 19 RC in April: Pre-warming for suspended trees : see Improvements to Suspense . React DOM static APIs : see New React DOM Static APIs . The date for this post has been updated to reflect the stable release date. React v19 is now available on npm! In our React 19 Upgrade Guide , we shared step-by-step instructions for upgrading your app to React 19. In this post, we’ll give an overview of the new features in React 19, and how you can adopt them. What’s new in React 19 Improvements in React 19 How to upgrade For a list of breaking changes, see the Upgrade Guide . What’s new in React 19 Actions A common use case in React apps is to perform a data mutation and then update state in response. For example, when a user submits a form to change their name, you will make an API request, and then handle the response. In the past, you would need to handle pending states, errors, optimistic updates, and sequential requests manually. For example, you could handle the pending and error state in useState : // Before Actions function UpdateName ( { } ) { const [ name , setName ] = useState ( \"\" ) ; const [ error , setError ] = useState ( null ) ; const [ isPending , setIsPending ] = useState ( false ) ; const handleSubmit = async ( ) => { setIsPending ( true ) ; const error = await updateName ( name ) ; setIsPending ( false ) ; if ( error ) { setError ( error ) ; return ; } redirect ( \"/path\" ) ; } ; return ( < div > < input value = { name } onChange = { ( event ) => setName ( event . target . value ) } /> < button onClick = { handleSubmit } disabled = { isPending } > Update </ button > { error && < p > { error } </ p > } </ div > ) ; } In React 19, we’re adding support for using async functions in transitions to handle pending states, errors, forms, and optimistic updates automatically. For example, you can use useTransition to handle the pending state for you: // Using pending state from Actions function UpdateName ( { } ) { const [ name , setName ] = useState ( \"\" ) ; const [ error , setError ] = useState ( null ) ; const [ isPending , startTransition ] = useTransition ( ) ; const handleSubmit = ( ) => { startTransition ( async ( ) => { const error = await updateName ( name ) ; if ( error ) { setError ( error ) ; return ; } redirect ( \"/path\" ) ; } ) } ; return ( < div > < input value = { name } onChange = { ( event ) => setName ( event . target . value ) } /> < button onClick = { handleSubmit } disabled = { isPending } > Update </ button > { error && < p > { error } </ p > } </ div > ) ; } The async transition will immediately set the isPending state to true, make the async request(s), and switch isPending to false after any transitions. This allows you to keep the current UI responsive and interactive while the data is changing. Note By convention, functions that use async transitions are called “Actions”. Actions automatically manage submitting data for you: Pending state : Actions provide a pending state that starts at the beginning of a request and automatically resets when the final state update is committed. Optimistic updates : Actions support the new useOptimistic hook so you can show users instant feedback while the requests are submitting. Error handling : Actions provide error handling so you can display Error Boundaries when a request fails, and revert optimistic updates to their original value automatically. Forms : <form> elements now support passing functions to the action and formAction props. Passing functions to the action props use Actions by default and reset the form automatically after submission. Building on top of Actions, React 19 introduces useOptimistic to manage optimistic updates, and a new hook React.useActionState to handle common cases for Actions. In react-dom we’re adding <form> Actions to manage forms automatically and useFormStatus to support the common cases for Actions in forms. In React 19, the above example can be simplified to: // Using <form> Actions and useActionState function ChangeName ( { name , setName } ) { const [ error , submitAction , isPending ] = useActionState ( async ( previousState , formData ) => { const error = await updateName ( formData . get ( \"name\" ) ) ; if ( error ) { return error ; } redirect ( \"/path\" ) ; return null ; } , null , ) ; return ( < form action = { submitAction } > < input type = \"text\" name = \"name\" /> < button type = \"submit\" disabled = { isPending } > Update </ button > { error && < p > { error } </ p > } </ form > ) ; } In the next section, we’ll break down each of the new Action features in React 19. New hook: useActionState To make the common cases easier for Actions, we’ve added a new hook called useActionState : const [ error , submitAction , isPending ] = useActionState ( async ( previousState , newName ) => { const error = await updateName ( newName ) ; if ( error ) { // You can return any result of the action. // Here, we return only the error. return error ; } // handle success return null ; } , null , ) ; useActionState accepts a function (the “Action”), and returns a wrapped Action to call. This works because Actions compose. When the wrapped Action is called, useActionState will return the last result of the Action as data , and the pending state of the Action as pending . Note React.useActionState was previously called ReactDOM.useFormState in the Canary releases, but we’ve renamed it and deprecated useFormState . See #28491 for more info. For more information, see the docs for useActionState . React DOM: <form> Actions Actions are also integrated with React 19’s new <form> features for react-dom . We’ve added support for passing functions as the action and formAction props of <form> , <input> , and <button> elements to automatically submit forms with Actions: < form action = { actionFunction } > When a <form> Action succeeds, React will automatically reset the form for uncontrolled components. If you need to reset the <form> manually, you can call the new requestFormReset React DOM API. For more information, see the react-dom docs for <form> , <input> , and <button> . React DOM: New hook: useFormStatus In design systems, it’s common to write design components that need access to information about the <form> they’re in, without drilling props down to the component. This can be done via Context, but to make the common case easier, we’ve added a new hook useFormStatus : import { useFormStatus } from 'react-dom' ; function DesignButton ( ) { const { pending } = useFormStatus ( ) ; return < button type = \"submit\" disabled = { pending } /> } useFormStatus reads the status of the parent <form> as if the form was a Context provider. For more information, see the react-dom docs for useFormStatus . New hook: useOptimistic Another common UI pattern when performing a data mutation is to show the final state optimistically while the async request is underway. In React 19, we’re adding a new hook called useOptimistic to make this easier: function ChangeName ( { currentName , onUpdateName } ) { const [ optimisticName , setOptimisticName ] = useOptimistic ( currentName ) ; const submitAction = async formData => { const newName = formData . get ( \"name\" ) ; setOptimisticName ( newName ) ; const updatedName = await updateName ( newName ) ; onUpdateName ( updatedName ) ; } ; return ( < form action = { submitAction } > < p > Your name is: { optimisticName } </ p > < p > < label > Change Name: </ label > < input type = \"text\" name = \"name\" disabled = { currentName !== optimisticName } /> </ p > </ form > ) ; } The useOptimistic hook will immediately render the optimisticName while the updateName request is in progress. When the update finishes or errors, React will automatically switch back to the currentName value. For more information, see the docs for useOptimistic . New API: use In React 19 we’re introducing a new API to read resources in render: use . For example, you can read a promise with use , and React will Suspend until the promise resolves: import { use } from 'react' ; function Comments ( { commentsPromise } ) { // `use` will suspend until the promise resolves. const comments = use ( commentsPromise ) ; return comments . map ( comment => < p key = { comment . id } > { comment } </ p > ) ; } function Page ( { commentsPromise } ) { // When `use` suspends in Comments, // this Suspense boundary will be shown. return ( < Suspense fallback = { < div > Loading... </ div > } > < Comments commentsPromise = { commentsPromise } /> </ Suspense > ) } Note use does not support promises created in render. If you try to pass a promise created in render to use , React will warn: Console A component was suspended by an uncached promise. Creating promises inside a Client Component or hook is not yet supported, except via a Suspense-compatible library or framework. To fix, you need to pass a promise from a Suspense powered library or framework that supports caching for promises. In the future we plan to ship features to make it easier to cache promises in render. You can also read context with use , allowing you to read Context conditionally such as after early returns: import { use } from 'react' ; import ThemeContext from './ThemeContext' function Heading ( { children } ) { if ( children == null ) { return null ; } // This would not work with useContext // because of the early return. const theme = use ( ThemeContext ) ; return ( < h1 style = { { color : theme . color } } > { children } </ h1 > ) ; } The use API can only be called in render, similar to hooks. Unlike hooks, use can be called conditionally. In the future we plan to support more ways to consume resources in render with use . For more information, see the docs for use . New React DOM Static APIs We’ve added two new APIs to react-dom/static for static site generation: prerender prerenderToNodeStream These new APIs improve on renderToString by waiting for data to load for static HTML generation. They are designed to work with streaming environments like Node.js Streams and Web Streams. For example, in a Web Stream environment, you can prerender a React tree to static HTML with prerender : import { prerender } from 'react-dom/static' ; async function handler ( request ) { const { prelude } = await prerender ( < App /> , { bootstrapScripts : [ '/main.js' ] } ) ; return new Response ( prelude , { headers : { 'content-type' : 'text/html' } , } ) ; } Prerender APIs will wait for all data to load before returning the static HTML stream. Streams can be converted to strings, or sent with a streaming response. They do not support streaming content as it loads, which is supported by the existing React DOM server rendering APIs . For more information, see React DOM Static APIs . React Server Components Server Components Server Components are a new option that allows rendering components ahead of time, before bundling, in an environment separate from your client application or SSR server. This separate environment is the “server” in React Server Components. Server Components can run once at build time on your CI server, or they can be run for each request using a web server. React 19 includes all of the React Server Components features included from the Canary channel. This means libraries that ship with Server Components can now target React 19 as a peer dependency with a react-server export condition for use in frameworks that support the Full-stack React Architecture . Note How do I build support for Server Components? While React Server Components in React 19 are stable and will not break between minor versions, the underlying APIs used to implement a React Server Components bundler or framework do not follow semver and may break between minors in React 19.x. To support React Server Components as a bundler or framework, we recommend pinning to a specific React version, or using the Canary release. We will continue working with bundlers and frameworks to stabilize the APIs used to implement React Server Components in the future. For more, see the docs for React Server Components . Server Actions Server Actions allow Client Components to call async functions executed on the server. When a Server Action is defined with the \"use server\" directive, your framework will automatically create a reference to the server function, and pass that reference to the Client Component. When that function is called on the client, React will send a request to the server to execute the function, and return the result. Note There is no directive for Server Components. A common misunderstanding is that Server Components are denoted by \"use server\" , but there is no directive for Server Components. The \"use server\" directive is used for Server Actions. For more info, see the docs for Directives . Server Actions can be created in Server Components and passed as props to Client Components, or they can be imported and used in Client Components. For more, see the docs for React Server Actions . Improvements in React 19 ref as a prop Starting in React 19, you can now access ref as a prop for function components: function MyInput ( { placeholder , ref } ) { return < input placeholder = { placeholder } ref = { ref } /> } //... < MyInput ref = { ref } /> New function components will no longer need forwardRef , and we will be publishing a codemod to automatically update your components to use the new ref prop. In future versions we will deprecate and remove forwardRef . Note ref s passed to classes are not passed as props since they reference the component instance. Diffs for hydration errors We also improved error reporting for hydration errors in react-dom . For example, instead of logging multiple errors in DEV without any information about the mismatch: Console Warning: Text content did not match. Server: “Server” Client: “Client” at span at App Warning: An error occurred during hydration. The server HTML was replaced with client content in <div>. Warning: Text content did not match. Server: “Server” Client: “Client” at span at App Warning: An error occurred during hydration. The server HTML was replaced with client content in <div>. Uncaught Error: Text content does not match server-rendered HTML. at checkForUnmatchedText … We now log a single message with a diff of the mismatch: Console Uncaught Error: Hydration failed because the server rendered HTML didn’t match the client. As a result this tree will be regenerated on the client. This can happen if an SSR-ed Client Component used: - A server/client branch if (typeof window !== 'undefined') . - Variable input such as Date.now() or Math.random() which changes each time it’s called. - Date formatting in a user’s locale which doesn’t match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting. It can also happen if the client has a browser extension installed which messes with the HTML before React loaded. https://react.dev/link/hydration-mismatch <App> <span> + Client - Server at throwOnHydrationMismatch … <Context> as a provider In React 19, you can render <Context> as a provider instead of <Context.Provider> : const ThemeContext = createContext ( '' ) ; function App ( { children } ) { return ( < ThemeContext value = \"dark\" > { children } </ ThemeContext > ) ; } New Context providers can use <Context> and we will be publishing a codemod to convert existing providers. In future versions we will deprecate <Context.Provider> . Cleanup functions for refs We now support returning a cleanup function from ref callbacks: < input ref = { ( ref ) => { // ref created // NEW: return a cleanup function to reset // the ref when element is removed from DOM. return ( ) => { // ref cleanup } ; } } /> When the component unmounts, React will call the cleanup function returned from the ref callback. This works for DOM refs, refs to class components, and useImperativeHandle . Note Previously, React would call ref functions with null when unmounting the component. If your ref returns a cleanup function, React will now skip this step. In future versions, we will deprecate calling refs with null when unmounting components. Due to the introduction of ref cleanup functions, returning anything else from a ref callback will now be rejected by TypeScript. The fix is usually to stop using implicit returns, for example: - < div ref = { current => ( instance = current ) } /> + < div ref = { current => { instance = current } } /> The original code returned the instance of the HTMLDivElement and TypeScript wouldn’t know if this was supposed to be a cleanup function or if you didn’t want to return a cleanup function. You can codemod this pattern with no-implicit-ref-callback-return . useDeferredValue initial value We’ve added an initialValue option to useDeferredValue : function Search ( { deferredValue } ) { // On initial render the value is ''. // Then a re-render is scheduled with the deferredValue. const value = useDeferredValue ( deferredValue , '' ) ; return ( < Results query = { value } /> ) ; } When initialValue is provided, useDeferredValue will return it as value for the initial render of the component, and schedules a re-render in the background with the deferredValue returned. For more, see useDeferredValue . Support for Document Metadata In HTML, document metadata tags like <title> , <link> , and <meta> are reserved for placement in the <head> section of the document. In React, the component that decides what metadata is appropriate for the app may be very far from the place where you render the <head> or React does not render the <head> at all. In the past, these elements would need to be inserted manually in an effect, or by libraries like react-helmet , and required careful handling when server rendering a React application. In React 19, we’re adding support for rendering document metadata tags in components natively: function BlogPost ( { post } ) { return ( < article > < h1 > { post . title } </ h1 > < title > { post . title } </ title > < meta name = \"author\" content = \"Josh\" /> < link rel = \"author\" href = \"https://twitter.com/joshcstory/\" /> < meta name = \"keywords\" content = { post . keywords } /> < p > Eee equals em-see-squared... </ p > </ article > ) ; } When React renders this component, it will see the <title> <link> and <meta> tags, and automatically hoist them to the <head> section of document. By supporting these metadata tags natively, we’re able to ensure they work with client-only apps, streaming SSR, and Server Components. Note You may still want a Metadata library For simple use cases, rendering Document Metadata as tags may be suitable, but libraries can offer more powerful features like overriding generic metadata with specific metadata based on the current route. These features make it easier for frameworks and libraries like react-helmet to support metadata tags, rather than replace them. For more info, see the docs for <title> , <link> , and <meta> . Support for stylesheets Stylesheets, both externally linked ( <link rel=\"stylesheet\" href=\"...\"> ) and inline ( <style>...</style> ), require careful positioning in the DOM due to style precedence rules. Building a stylesheet capability that allows for composability within components is hard, so users often end up either loading all of their styles far from the components that may depend on them, or they use a style library which encapsulates this complexity. In React 19, we’re addressing this complexity and providing even deeper integration into Concurrent Rendering on the Client and Streaming Rendering on the Server with built in support for stylesheets. If you tell React the precedence of your stylesheet it will manage the insertion order of the stylesheet in the DOM and ensure that the stylesheet (if external) is loaded before revealing content that depends on those style rules. function ComponentOne ( ) { return ( < Suspense fallback = \"loading...\" > < link rel = \"stylesheet\" href = \"foo\" precedence = \"default\" /> < link rel = \"stylesheet\" href = \"bar\" precedence = \"high\" /> < article class = \"foo-class bar-class\" > { ... } </ article > </ Suspense > ) } function ComponentTwo ( ) { return ( < div > < p > { ... } </ p > < link rel = \"stylesheet\" href = \"baz\" precedence = \"default\" /> < -- will be inserted between foo & bar </ div > ) } During Server Side Rendering React will include the stylesheet in the <head> , which ensures that the browser will not paint until it has loaded. If the stylesheet is discovered late after we’ve already started streaming, React will ensure that the stylesheet is inserted into the <head> on the client before revealing the content of a Suspense boundary that depends on that stylesheet. During Client Side Rendering React will wait for newly rendered stylesheets to load before committing the render. If you render this component from multiple places within your application React will only include the stylesheet once in the document: function App ( ) { return < > < ComponentOne /> ... < ComponentOne /> // won't lead to a duplicate stylesheet link in the DOM </ > } For users accustomed to loading stylesheets manually this is an opportunity to locate those stylesheets alongside the components that depend on them allowing for better local reasoning and an easier time ensuring you only load the stylesheets that you actually depend on. Style libraries and style integrations with bundlers can also adopt this new capability so even if you don’t directly render your own stylesheets, you can still benefit as your tools are upgraded to use this feature. For more details, read the docs for <link> and <style> . Support for async scripts In HTML normal scripts ( <script src=\"...\"> ) and deferred scripts ( <script defer=\"\" src=\"...\"> ) load in document order which makes rendering these kinds of scripts deep within your component tree challenging. Async scripts ( <script async=\"\" src=\"...\"> ) however will load in arbitrary order. In React 19 we’ve included better support for async scripts by allowing you to render them anywhere in your component tree, inside the components that actually depend on the script, without having to manage relocating and deduplicating script instances. function MyComponent ( ) { return ( < div > < script async = { true } src = \"...\" /> Hello World </ div > ) } function App ( ) { < html > < body > < MyComponent > ... < MyComponent > // won't lead to duplicate script in the DOM </ body > </ html > } In all rendering environments, async scripts will be deduplicated so that React will only load and execute the script once even if it is rendered by multiple different components. In Server Side Rendering, async scripts will be included in the <head> and prioritized behind more critical resources that block paint such as stylesheets, fonts, and image preloads. For more details, read the docs for <script> . Support for preloading resources During initial document load and on client side updates, telling the Browser about resources that it will likely need to load as early as possible can have a dramatic effect on page performance. React 19 includes a number of new APIs for loading and preloading Browser resources to make it as easy as possible to build great experiences that aren’t held back by inefficient resource loading. import { prefetchDNS , preconnect , preload , preinit } from 'react-dom' function MyComponent ( ) { preinit ( 'https://.../path/to/some/script.js' , { as : 'script' } ) // loads and executes this script eagerly preload ( 'https://.../path/to/font.woff' , { as : 'font' } ) // preloads this font preload ( 'https://.../path/to/stylesheet.css' , { as : 'style' } ) // preloads this stylesheet prefetchDNS ( 'https://...' ) // when you may not actually request anything from this host preconnect ( 'https://...' ) // when you will request something but aren't sure what } <!-- the above would result in the following DOM/HTML --> < html > < head > <!-- links/scripts are prioritized by their utility to early loading, not call order --> < link rel = \"prefetch-dns\" href = \"https://...\" > < link rel = \"preconnect\" href = \"https://...\" > < link rel = \"preload\" as = \"font\" href = \"https://.../path/to/font.woff\" > < link rel = \"preload\" as = \"style\" href = \"https://.../path/to/stylesheet.css\" > < script async = \"\" src = \"https://.../path/to/some/script.js\" > </ script > </ head > < body > ... </ body > </ html > These APIs can be used to optimize initial page loads by moving discovery of additional resources like fonts out of stylesheet loading. They can also make client updates faster by prefetching a list of resources used by an anticipated navigation and then eagerly preloading those resources on click or even on hover. For more details see Resource Preloading APIs . Compatibility with third-party scripts and extensions We’ve improved hydration to account for third-party scripts and browser extensions. When hydrating, if an element that renders on the client doesn’t match the element found in the HTML from the server, React will force a client re-render to fix up the content. Previously, if an element was inserted by third-party scripts or browser extensions, it would trigger a mismatch error and client render. In React 19, unexpected tags in the <head> and <body> will be skipped over, avoiding the mismatch errors. If React needs to re-render the entire document due to an unrelated hydration mismatch, it will leave in place stylesheets inserted by third-party scripts and browser extensions. Better error reporting We improved error handling in React 19 to remove duplication and provide options for handling caught and uncaught errors. For example, when there’s an error in render caught by an Error Boundary, previously React would throw the error twice (once for the original error, then again after failing to automatically recover), and then call console.error with info about where the error occurred. This resulted in three errors for every caught error: Console Uncaught Error: hit at Throws at renderWithHooks … Uncaught Error: hit <-- Duplicate at Throws at renderWithHooks … The above error occurred in the Throws component: at Throws at ErrorBoundary at App React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary. In React 19, we log a single error with all the error information included: Console Error: hit at Throws at renderWithHooks … The above error occurred in the Throws component: at Throws at ErrorBoundary at App React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary. at ErrorBoundary at App Additionally, we’ve added two new root options to complement onRecoverableError : onCaughtError : called when React catches an error in an Error Boundary. onUncaughtError : called when an error is thrown and not caught by an Error Boundary. onRecoverableError : called when an error is thrown and automatically recovered. For more info and examples, see the docs for createRoot and hydrateRoot . Support for Custom Elements React 19 adds full support for custom elements and passes all tests on Custom Elements Everywhere . In past versions, using Custom Elements in React has been difficult because React treated unrecognized props as attributes rather than properties. In React 19, we’ve added support for properties that works on the client and during SSR with the following strategy: Server Side Rendering : props passed to a custom element will render as attributes if their type is a primitive value like string , number , or the value is true . Props with non-primitive types like object , symbol , function , or value false will be omitted. Client Side Rendering : props that match a property on the Custom Element instance will be assigned as properties, otherwise they will be assigned as attributes. Thanks to Joey Arhar for driving the design and implementation of Custom Element support in React. How to upgrade See the React 19 Upgrade Guide for step-by-step instructions and a full list of breaking and notable changes. Note: this post was originally published 04/25/2024 and has been updated to 12/05/2024 with the stable release.",
+    "quality_score": 9,
+    "modules": [
+      "react_patterns",
+      "api_design",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
+    "title": "React 19 Upgrade Guide",
+    "source_name": "React Blog",
+    "text": "April 25, 2024 by Ricky Hanlon The improvements added to React 19 require some breaking changes, but we’ve worked to make the upgrade as smooth as possible, and we don’t expect the changes to impact most apps. Note React 18.3 has also been published To help make the upgrade to React 19 easier, we’ve published a react@18.3 release that is identical to 18.2 but adds warnings for deprecated APIs and other changes that are needed for React 19. We recommend upgrading to React 18.3 first to help identify any issues before upgrading to React 19. For a list of changes in 18.3 see the Release Notes . In this post, we will guide you through the steps for upgrading to React 19: Installing Codemods Breaking changes New deprecations Notable changes TypeScript changes Changelog If you’d like to help us test React 19, follow the steps in this upgrade guide and report any issues you encounter. For a list of new features added to React 19, see the React 19 release post . Installing Note New JSX Transform is now required We introduced a new JSX transform in 2020 to improve bundle size and use JSX without importing React. In React 19, we’re adding additional improvements like using ref as a prop and JSX speed improvements that require the new transform. If the new transform is not enabled, you will see this warning: Console Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform We expect most apps will not be affected since the transform is enabled in most environments already. For manual instructions on how to upgrade, please see the announcement post . To install the latest version of React and React DOM: npm install -- save - exact react @^ 19.0 . 0 react - dom @^ 19.0 .0 Or, if you’re using Yarn: yarn add -- exact react @^ 19.0 .0 react - dom @^ 19.0 . 0 If you’re using TypeScript, you also need to update the types. npm install -- save - exact @ types /react@^19.0.0 @types/ react - dom @^ 19.0 . 0 Or, if you’re using Yarn: yarn add -- exact @ types /react@^19.0.0 @types/ react - dom @^ 19.0 . 0 We’re also including a codemod for the most common replacements. See TypeScript changes below. Codemods To help with the upgrade, we’ve worked with the team at codemod.com to publish codemods that will automatically update your code to many of the new APIs and patterns in React 19. All codemods are available in the react-codemod repo and the Codemod team have joined in helping maintain the codemods. To run these codemods, we recommend using the codemod command instead of the react-codemod because it runs faster, handles more complex code migrations, and provides better support for TypeScript. Changes that include a codemod include the command below. For a list of all available codemods, see the react-codemod repo . Breaking changes Errors in render are not re-thrown In previous versions of React, errors thrown during render were caught and rethrown. In DEV, we would also log to console.error , resulting in duplicate error logs. In React 19, we’ve improved how errors are handled to reduce duplication by not re-throwing: Uncaught Errors : Errors that are not caught by an Error Boundary are reported to window.reportError . Caught Errors : Errors that are caught by an Error Boundary are reported to console.error . This change should not impact most apps, but if your production error reporting relies on errors being re-thrown, you may need to update your error handling. To support this, we’ve added new methods to createRoot and hydrateRoot for custom error handling: const root = createRoot ( container , { onUncaughtError : ( error , errorInfo ) => { // ... log error report } , onCaughtError : ( error , errorInfo ) => { // ... log error report } } ) ; For more info, see the docs for createRoot and hydrateRoot . Removed deprecated React APIs Removed: propTypes and defaultProps for functions PropTypes were deprecated in April 2017 (v15.5.0) . In React 19, we’re removing the propType checks from the React package, and using them will be silently ignored. If you’re using propTypes , we recommend migrating to TypeScript or another type-checking solution. We’re also removing defaultProps from function components in place of ES6 default parameters. Class components will continue to support defaultProps since there is no ES6 alternative. // Before import PropTypes from 'prop-types' ; function Heading ( { text } ) { return < h1 > { text } </ h1 > ; } Heading . propTypes = { text : PropTypes . string , } ; Heading . defaultProps = { text : 'Hello, world!' , } ; // After interface Props { text ? : string ; } function Heading ( { text = 'Hello, world!' } : Props ) { return < h1 > { text } </ h1 > ; } Note Codemod propTypes to TypeScript with: npx codemod @ latest react / prop - types - typescript Removed: Legacy Context using contextTypes and getChildContext Legacy Context was deprecated in October 2018 (v16.6.0) . Legacy Context was only available in class components using the APIs contextTypes and getChildContext , and was replaced with contextType due to subtle bugs that were easy to miss. In React 19, we’re removing Legacy Context to make React slightly smaller and faster. If you’re still using Legacy Context in class components, you’ll need to migrate to the new contextType API: // Before import PropTypes from 'prop-types' ; class Parent extends React . Component { static childContextTypes = { foo : PropTypes . string . isRequired , } ; getChildContext ( ) { return { foo : 'bar' } ; } render ( ) { return < Child /> ; } } class Child extends React . Component { static contextTypes = { foo : PropTypes . string . isRequired , } ; render ( ) { return < div > { this . context . foo } </ div > ; } } // After const FooContext = React . createContext ( ) ; class Parent extends React . Component { render ( ) { return ( < FooContext value = 'bar' > < Child /> </ FooContext > ) ; } } class Child extends React . Component { static contextType = FooContext ; render ( ) { return < div > { this . context } </ div > ; } } Removed: string refs String refs were deprecated in March, 2018 (v16.3.0) . Class components supported string refs before being replaced by ref callbacks due to multiple downsides . In React 19, we’re removing string refs to make React simpler and easier to understand. If you’re still using string refs in class components, you’ll need to migrate to ref callbacks: // Before class MyComponent extends React . Component { componentDidMount ( ) { this . refs . input . focus ( ) ; } render ( ) { return < input ref = 'input' /> ; } } // After class MyComponent extends React . Component { componentDidMount ( ) { this . input . focus ( ) ; } render ( ) { return < input ref = { input => this . input = input } /> ; } } Note Codemod string refs with ref callbacks: npx codemod @ latest react / 19 / replace - string - ref Removed: Module pattern factories Module pattern factories were deprecated in August 2019 (v16.9.0) . This pattern was rarely used and supporting it causes React to be slightly larger and slower than necessary. In React 19, we’re removing support for module pattern factories, and you’ll need to migrate to regular functions: // Before function FactoryComponent ( ) { return { render ( ) { return < div /> ; } } } // After function FactoryComponent ( ) { return < div /> ; } Removed: React.createFactory createFactory was deprecated in February 2020 (v16.13.0) . Using createFactory was common before broad support for JSX, but it’s rarely used today and can be replaced with JSX. In React 19, we’re removing createFactory and you’ll need to migrate to JSX: // Before import { createFactory } from 'react' ; const button = createFactory ( 'button' ) ; // After const button = < button /> ; Removed: react-test-renderer/shallow In React 18, we updated react-test-renderer/shallow to re-export react-shallow-renderer . In React 19, we’re removing react-test-render/shallow to prefer installing the package directly: npm install react - shallow - renderer -- save - dev - import ShallowRenderer from 'react-test-renderer/shallow' ; + import ShallowRenderer from 'react-shallow-renderer' ; Removed deprecated React DOM APIs Removed: react-dom/test-utils We’ve moved act from react-dom/test-utils to the react package: Console ReactDOMTestUtils.act is deprecated in favor of React.act . Import act from react instead of react-dom/test-utils . See https://react.dev/warnings/react-dom-test-utils for more info. To fix this warning, you can import act from react : - import { act } from 'react-dom/test-utils' + import { act } from 'react' ; All other test-utils functions have been removed. These utilities were uncommon, and made it too easy to depend on low level implementation details of your components and React. In React 19, these functions will error when called and their exports will be removed in a future version. See the warning page for alternatives. Note Codemod ReactDOMTestUtils.act to React.act : npx codemod @ latest react / 19 / replace - act - import Removed: ReactDOM.render ReactDOM.render was deprecated in March 2022 (v18.0.0) . In React 19, we’re removing ReactDOM.render and you’ll need to migrate to using ReactDOM.createRoot : // Before import { render } from 'react-dom' ; render ( < App /> , document . getElementById ( 'root' ) ) ; // After import { createRoot } from 'react-dom/client' ; const root = createRoot ( document . getElementById ( 'root' ) ) ; root . render ( < App /> ) ; Note Codemod ReactDOM.render to ReactDOMClient.createRoot : npx codemod @ latest react / 19 / replace - reactdom - render Removed: ReactDOM.hydrate ReactDOM.hydrate was deprecated in March 2022 (v18.0.0) . In React 19, we’re removing ReactDOM.hydrate you’ll need to migrate to using ReactDOM.hydrateRoot , // Before import { hydrate } from 'react-dom' ; hydrate ( < App /> , document . getElementById ( 'root' ) ) ; // After import { hydrateRoot } from 'react-dom/client' ; hydrateRoot ( document . getElementById ( 'root' ) , < App /> ) ; Note Codemod ReactDOM.hydrate to ReactDOMClient.hydrateRoot : npx codemod @ latest react / 19 / replace - reactdom - render Removed: unmountComponentAtNode ReactDOM.unmountComponentAtNode was deprecated in March 2022 (v18.0.0) . In React 19, you’ll need to migrate to using root.unmount() . // Before unmountComponentAtNode ( document . getElementById ( 'root' ) ) ; // After root . unmount ( ) ; For more see root.unmount() for createRoot and hydrateRoot . Note Codemod unmountComponentAtNode to root.unmount : npx codemod @ latest react / 19 / replace - reactdom - render Removed: ReactDOM.findDOMNode ReactDOM.findDOMNode was deprecated in October 2018 (v16.6.0) . We’re removing findDOMNode because it was a legacy escape hatch that was slow to execute, fragile to refactoring, only returned the first child, and broke abstraction levels (see more here ). You can replace ReactDOM.findDOMNode with DOM refs : // Before import { findDOMNode } from 'react-dom' ; function AutoselectingInput ( ) { useEffect ( ( ) => { const input = findDOMNode ( this ) ; input . select ( ) } , [ ] ) ; return < input defaultValue = \"Hello\" /> ; } // After function AutoselectingInput ( ) { const ref = useRef ( null ) ; useEffect ( ( ) => { ref . current . select ( ) ; } , [ ] ) ; return < input ref = { ref } defaultValue = \"Hello\" /> } New deprecations Deprecated: element.ref React 19 supports ref as a prop , so we’re deprecating the element.ref in place of element.props.ref . Accessing element.ref will warn: Console Accessing element.ref is no longer supported. ref is now a regular prop. It will be removed from the JSX Element type in a future release. Deprecated: react-test-renderer We are deprecating react-test-renderer because it implements its own renderer environment that doesn’t match the environment users use, promotes testing implementation details, and relies on introspection of React’s internals. The test renderer was created before there were more viable testing strategies available like React Testing Library , and we now recommend using a modern testing library instead. In React 19, react-test-renderer logs a deprecation warning, and has switched to concurrent rendering. We recommend migrating your tests to @testing-library/react or @testing-library/react-native for a modern and well supported testing experience. Notable changes StrictMode changes React 19 includes several fixes and improvements to Strict Mode. When double rendering in Strict Mode in development, useMemo and useCallback will reuse the memoized results from the first render during the second render. Components that are already Strict Mode compatible should not notice a difference in behavior. As with all Strict Mode behaviors, these features are designed to proactively surface bugs in your components during development so you can fix them before they are shipped to production. For example, during development, Strict Mode will double-invoke ref callback functions on initial mount, to simulate what happens when a mounted component is replaced by a Suspense fallback. Improvements to Suspense In React 19, when a component suspends, React will immediately commit the fallback of the nearest Suspense boundary without waiting for the entire sibling tree to render. After the fallback commits, React schedules another render for the suspended siblings to “pre-warm” lazy requests in the rest of the tree: Previously, when a component suspended, the suspended siblings were rendered and then the fallback was committed. In React 19, when a component suspends, the fallback is committed and then the suspended siblings are rendered. This change means Suspense fallbacks display faster, while still warming lazy requests in the suspended tree. UMD builds removed UMD was widely used in the past as a convenient way to load React without a build step. Now, there are modern alternatives for loading modules as scripts in HTML documents. Starting with React 19, React will no longer produce UMD builds to reduce the complexity of its testing and release process. To load React 19 with a script tag, we recommend using an ESM-based CDN such as esm.sh . < script type = \"module\" > import React from \"https://esm.sh/react@19/?dev\" import ReactDOMClient from \"https://esm.sh/react-dom@19/client?dev\" ... </ script > Libraries depending on React internals may block upgrades This release includes changes to React internals that may impact libraries that ignore our pleas to not use internals like SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED . These changes are necessary to land improvements in React 19, and will not break libraries that follow our guidelines. Based on our Versioning Policy , these updates are not listed as breaking changes, and we are not including docs for how to upgrade them. The recommendation is to remove any code that depends on internals. To reflect the impact of using internals, we have renamed the SECRET_INTERNALS suffix to: _DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE In the future we will more aggressively block accessing internals from React to discourage usage and ensure users are not blocked from upgrading. TypeScript changes Removed deprecated TypeScript types We’ve cleaned up the TypeScript types based on the removed APIs in React 19. Some of the removed have types been moved to more relevant packages, and others are no longer needed to describe React’s behavior. Note We’ve published types-react-codemod to migrate most type related breaking changes: npx types - react - codemod @ latest preset - 19 ./ path - to - app If you have a lot of unsound access to element.props , you can run this additional codemod: npx types - react - codemod @ latest react - element - default - any - props ./ path - to - your - react - ts - files Check out types-react-codemod for a list of supported replacements. If you feel a codemod is missing, it can be tracked in the list of missing React 19 codemods . ref cleanups required This change is included in the react-19 codemod preset as no-implicit-ref-callback-return . Due to the introduction of ref cleanup functions, returning anything else from a ref callback will now be rejected by TypeScript. The fix is usually to stop using implicit returns: - < div ref = { current => ( instance = current ) } /> + < div ref = { current => { instance = current } } /> The original code returned the instance of the HTMLDivElement and TypeScript wouldn’t know if this was supposed to be a cleanup function or not. useRef requires an argument This change is included in the react-19 codemod preset as refobject-defaults . A long-time complaint of how TypeScript and React work has been useRef . We’ve changed the types so that useRef now requires an argument. This significantly simplifies its type signature. It’ll now behave more like createContext . // @ts-expect-error: Expected 1 argument but saw none useRef ( ) ; // Passes useRef ( undefined ) ; // @ts-expect-error: Expected 1 argument but saw none createContext ( ) ; // Passes createContext ( undefined ) ; This now also means that all refs are mutable. You’ll no longer hit the issue where you can’t mutate a ref because you initialised it with null : const ref = useRef < number > ( null ) ; // Cannot assign to 'current' because it is a read-only property ref . current = 1 ; MutableRef is now deprecated in favor of a single RefObject type which useRef will always return: interface RefObject < T > { current : T } declare function useRef <T> : RefObject < T > useRef still has a convenience overload for useRef<T>(null) that automatically returns RefObject<T | null> . To ease migration due to the required argument for useRef , a convenience overload for useRef(undefined) was added that automatically returns RefObject<T | undefined> . Check out [RFC] Make all refs mutable for prior discussions about this change. Changes to the ReactElement TypeScript type This change is included in the react-element-default-any-props codemod. The props of React elements now default to unknown instead of any if the element is typed as ReactElement . This does not affect you if you pass a type argument to ReactElement : type Example2 = ReactElement < { id : string } > [ \"props\" ] ; // ^? { id: string } But if you relied on the default, you now have to handle unknown : type Example = ReactElement [ \"props\" ] ; // ^? Before, was 'any', now 'unknown' You should only need it if you have a lot of legacy code relying on unsound access of element props. Element introspection only exists as an escape hatch, and you should make it explicit that your props access is unsound via an explicit any . The JSX namespace in TypeScript This change is included in the react-19 codemod preset as scoped-jsx A long-time request is to remove the global JSX namespace from our types in favor of React.JSX . This helps prevent pollution of global types which prevents conflicts between different UI libraries that leverage JSX. You’ll now need to wrap module augmentation of the JSX namespace in `declare module ”…”: // global.d.ts + declare module \"react\" { namespace JSX { interface IntrinsicElements { \"my-element\" : { myElementProps : string ; } ; } } + } The exact module specifier depends on the JSX runtime you specified in the compilerOptions of your tsconfig.json : For \"jsx\": \"react-jsx\" it would be react/jsx-runtime . For \"jsx\": \"react-jsxdev\" it would be react/jsx-dev-runtime . For \"jsx\": \"react\" and \"jsx\": \"preserve\" it would be react . Better useReducer typings useReducer now has improved type inference thanks to @mfp22 . However, this required a breaking change where useReducer doesn’t accept the full reducer type as a type parameter but instead either needs none (and rely on contextual typing) or needs both the state and action type. The new best practice is not to pass type arguments to useReducer . - useReducer < React . Reducer < State , Action >> ( reducer ) + useReducer ( reducer ) This may not work in edge cases where you can explicitly type the state and action, by passing in the Action in a tuple: - useReducer < React . Reducer < State , Action >> ( reducer ) + useReducer < State , [ Action ] > ( reducer ) If you define the reducer inline, we encourage to annotate the function parameters instead: - useReducer < React . Reducer < State , Action >> ( ( state , action ) => state ) + useReducer ( ( state : State , action : Action ) => state ) This is also what you’d also have to do if you move the reducer outside of the useReducer call: const reducer = ( state : State , action : Action ) => state ; Changelog Other breaking changes react-dom : Error for javascript URLs in src and href #26507 react-dom : Remove errorInfo.digest from onRecoverableError #28222 react-dom : Remove unstable_flushControlled #26397 react-dom : Remove unstable_createEventHandle #28271 react-dom : Remove unstable_renderSubtreeIntoContainer #28271 react-dom : Remove unstable_runWithPriority #28271 react-is : Remove deprecated methods from react-is 28224 Other notable changes react : Batch sync, default and continuous lanes #25700 react : Don’t prerender siblings of suspended component #26380 react : Detect infinite update loops caused by render phase updates #26625 react-dom : Transitions in popstate are now synchronous #26025 react-dom : Remove layout effect warning during SSR #26395 react-dom : Warn and don’t set empty string for src/href (except anchor tags) #28124 For a full list of changes, please see the Changelog . Thanks to Andrew Clark , Eli White , Jack Pope , Jan Kassens , Josh Story , Matt Carroll , Noah Lemen , Sophie Alpert , and Sebastian Silbermann for reviewing and editing this post.",
+    "quality_score": 8,
+    "modules": [
+      "react_patterns",
+      "type_system",
+      "dx"
+    ]
   }
 ]

```

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | The system was producing ~0 posts. | needs_human | | |
| 1 | Not "fewer than expected" — zero. | needs_human | | |
| 2 | Three bugs were compounding each other into silence. | needs_human | | |
| 3 | First: the detection modules were too narrow. | needs_human | | |
| 4 | Without a general engineering category, valid commits fell through every filter. | needs_human | | |
| 5 | Second: events_state wasn't persisted to Supabase, so every run re-fetched API data it had already seen. | needs_human | | |
| 6 | Third: no in-memory SHA deduplication meant the same commit could be enriched multiple times in a single run. | needs_human | | |
| 7 | Any one of these would degrade output. | needs_human | | |
| 8 | All three together meant the system burned API budget, re-processed the same work, and still produced nothing users could read. | needs_human | | |
| 9 | The fix surfaces all three in the same ADR batch — nine architecture decision records written together, alongside a consolidated 3,400-line v1.5.17 master spec. | needs_human | | |
| 10 | That's a meaningful choice: treating three separate failure modes as a single architectural moment rather than three independent patches. | needs_human | | |
| 11 | The dedup fix is a Set<string> in memory. | needs_human | | |
| 12 | The state persistence is two methods added to SupabaseStorage. | needs_human | | |
| 13 | The module expansion is a threshold change plus a new category. | needs_human | | |
| 14 | Each one is small. | needs_human | | |
| 15 | Naming them together is what makes the system legible to the next person who has to debug it. | needs_human | | |
| 16 | The seed corpus work running in parallel — 100+ curated articles across Go generics, Python JIT, React governance, Quarkus LTS, concurrency scheduling — is the other half of that legibility story. | needs_human | | |
| 17 | A content system needs reference material that reflects real engineering decisions, not just popular posts. | needs_human | | |
| 18 | Container-aware GOMAXPROCS latency implications and CPython JIT tradeoffs aren't filler; they're the calibration layer. | needs_human | | |
| 19 | Silence is a hard failure mode to catch because it looks like "not ready yet." These commits made it diagnosable. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
