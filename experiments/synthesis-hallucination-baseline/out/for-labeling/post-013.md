# Post 013

## Post generado

> The seed corpus just got a concurrency upgrade worth talking about.
> 
> A new entry landed covering container-aware GOMAXPROCS — specifically how Go's goroutine scheduler behaves when CPU limits are enforced by Kubernetes. The problem it surfaces is classic and quietly brutal: your Go process asks the OS how many CPUs are available, gets the node count, and happily spins up far more OS threads than your container's CPU quota actually allows. Latency spikes. Throttling happens. Nobody immediately knows why.
> 
> The fix is a runtime-level default that makes GOMAXPROCS reflect the container's actual CPU limit rather than the host's total. It's a small configuration surface with outsized production consequences — the kind of thing that looks fine in staging, bites you in prod, and generates a postmortem that says "scheduling" in the title.
> 
> What makes this entry worth tracking in an error-resilience corpus is that it's not about catching exceptions or retrying failed calls. It's about removing a whole class of latency degradation by matching concurrency assumptions to runtime constraints. The failure mode being addressed isn't a crash — it's a system quietly misbehaving under load because its own defaults are lying to it.
> 
> Accurate concurrency configuration is error resilience. You don't need a circuit breaker if you never saturate the scheduler in the first place.
> 
> The corpus is doing its job: surfacing the concrete, operationally-grounded articles that turn "best practices" into actual production defaults.
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

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | The seed corpus just got a concurrency upgrade worth talking about. | needs_human | | |
| 1 | A new entry landed covering container-aware GOMAXPROCS — specifically how Go's goroutine scheduler behaves when CPU limits are enforced by Kubernetes. | needs_human | | |
| 2 | The problem it surfaces is classic and quietly brutal: your Go process asks the OS how many CPUs are available, gets the node count, and happily spins up far more OS threads than your container's CPU  | needs_human | | |
| 3 | Nobody immediately knows why. | needs_human | | |
| 4 | The fix is a runtime-level default that makes GOMAXPROCS reflect the container's actual CPU limit rather than the host's total. | needs_human | | |
| 5 | It's a small configuration surface with outsized production consequences — the kind of thing that looks fine in staging, bites you in prod, and generates a postmortem that says "scheduling" in the tit | needs_human | | |
| 6 | What makes this entry worth tracking in an error-resilience corpus is that it's not about catching exceptions or retrying failed calls. | needs_human | | |
| 7 | It's about removing a whole class of latency degradation by matching concurrency assumptions to runtime constraints. | needs_human | | |
| 8 | The failure mode being addressed isn't a crash — it's a system quietly misbehaving under load because its own defaults are lying to it. | needs_human | | |
| 9 | Accurate concurrency configuration is error resilience. | needs_human | | |
| 10 | You don't need a circuit breaker if you never saturate the scheduler in the first place. | needs_human | | |
| 11 | The corpus is doing its job: surfacing the concrete, operationally-grounded articles that turn "best practices" into actual production defaults. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
