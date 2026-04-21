# Post 015

## Post generado

> Tenant tokens were sitting in Supabase as plaintext. That's the kind of thing that's fine until it isn't.
> 
> One commit changed the shape of that risk entirely.
> 
> The new flow is envelope encryption backed by GCP KMS. When a tenant onboards or completes an OAuth callback, `sealTenantSecrets` encrypts the Buffer and LinkedIn credentials before they're written. At runtime, the worker and scanner call `resolveTenantSecrets` to decrypt via KMS. The data encryption key lives in an `encrypted_dek` column in Supabase — the KMS key never touches the credential directly.
> 
> That's the classic envelope pattern: KMS protects the DEK, the DEK protects the data. Rotating the KMS key doesn't require re-encrypting every row. Re-encrypting rows doesn't require touching KMS quotas. The two concerns stay decoupled.
> 
> A rotation script also ships alongside — specifically to re-encrypt legacy plaintext rows that were already stored. The migration path is handled, not left as a follow-up.
> 
> Then, two days later, KMS key name gets wired into CI secrets and the bootstrap step runs under the same credential scope. The security boundary isn't just in the app code — it propagates into the pipeline.
> 
> The ADR covering this landed as ADR-accepted before implementation, which means the decision record and the working code arrived in the same window. That's the part that usually slips.
> 
> What changed: tenant credentials now have a concrete threat model. The failure mode isn't "someone reads the DB." It's "someone also compromises KMS" — a meaningfully harder bar.
> 
> #lilicurl #codingWithHumor

## Commits de origen

### Commit 1: 0a432c5
**Message:** feat: expand seed corpus with quarkus and react batch

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index a328941..9420e56 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -105,3 +105,9 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 104,track2,python_patterns,"type_system,performance",https://blog.python.org/2023/10/python-3120-final-now-available/,"Python 3.12.0 (final) now available","Python Insider","Thomas Wouters",2023-10-02,8,"A strong Python release post because it combines new generic syntax, override decorators, profiling APIs, subinterpreters, and concrete runtime performance improvements in one place.",kept,,
 105,track2,python_patterns,"type_system,concurrency",https://blog.python.org/2024/10/python-3130-final-released/,"Python 3.13.0 (final) released","Python Insider","Thomas Wouters",2024-10-07,9,"A high-signal Python article on experimental free threading, interpreter changes, and new typing features, which makes it especially useful for language and concurrency tradeoffs.",kept,,
 106,track2,python_patterns,"evolutionary,concurrency",https://pythoninsider.blogspot.com/2025/10/python-3140-final-is-here.html,"Python 3.14.0 (final) is here!","Python Insider","Hugo van Kemenade",2025-10-07,8,"A strong Python evolution article covering the move from experimental toward supported free threading, multiple interpreters, and other runtime changes that affect system design choices.",kept,,
+107,track2,java_patterns,"clean_code,testing",https://quarkus.io/blog/quarkus-component-test-update/,"Quarkus - a component testing update","Quarkus Blog","Martin Kouba",2025-10-20,8,"A practical Java testing article on isolating CDI components, automatic mocks, and cleaner test boundaries without booting a full Quarkus app.",kept,,
+108,track2,java_patterns,"clean_code,performance",https://quarkus.io/blog/building-large-applications/,"Towards faster builds","Quarkus Blog","Guillaume Smet",2026-01-13,8,"A useful build-engineering article that connects project structure, plugin configuration, and bytecode generation decisions to developer feedback loops in large Java applications.",kept,,
+109,track2,java_patterns,"design_patterns,integration",https://quarkus.io/blog/k8s-style-CEL-with-quarkus-chicory/,"A Go CEL Policy Engine in Java, with Quarkus Chicory","Quarkus Blog","Fabio Burzigotti",2026-02-19,9,"A strong design-patterns article because it explicitly uses clean architecture boundaries to embed a Go policy engine inside a Java service through WebAssembly.",kept,,
+110,track2,react_patterns,"js_advanced,performance",https://react.dev/blog/2025/10/01/react-19-2,"React 19.2","React Blog","The React Team",2025-10-01,9,"A high-signal React release post covering Activity, useEffectEvent, cacheSignal, performance tracks, and partial pre-rendering, which makes it excellent seed material for modern React architecture.",kept,,
+111,track2,react_patterns,"dependency_health,security",https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components,"Critical Security Vulnerability in React Server Components","React Blog","The React Team",2025-12-03,8,"A practical framework-security article that goes beyond a CVE notice by mapping affected packages, frameworks, and exact upgrade paths teams need to execute quickly.",kept,,
+112,track2,dependency_health,"security,devops",https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/,"Our plan for a more secure npm supply chain","The GitHub Blog","Xavier Rene-Corail",2025-09-22,8,"A solid dependency-health article on npm hardening, trusted publishing, and ecosystem-level guardrails that directly affect how teams manage package risk in CI/CD.",kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index 1af8088..1e16f20 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -1269,5 +1269,77 @@
       "evolutionary",
       "concurrency"
     ]
+  },
+  {
+    "url": "https://quarkus.io/blog/quarkus-component-test-update/",
+    "title": "Quarkus - a component testing update",
+    "source_name": "Quarkus Blog",
+    "text": "First, just a quick summary. The component model of Quarkus is built on top of CDI. An idiomatic way to test a Quarkus application is to use the quarkus-junit5 module and @QuarkusTest . However, in this case, a full Quarkus application needs to be built and started. In order to avoid unnecessary rebuilds and restarts the application is shared for multiple tests, unless a different test profile is used. One of the consequences is that some components (typically @ApplicationScoped and @Singleton CDI beans) are shared as well. What if you need to test the business logic of a component in isolation, with different states and inputs? For this use case, a plain unit test would make a lot of sense. However, writing unit tests for CDI beans without a running CDI container is often a tedious work. Dependency injection, events, interceptors - all the work has to be done manually and everything needs to be wired together by hand. In Quarkus 3.2, we introduced an experimental feature to ease the testing of CDI components and mocking of their dependencies. It’s a JUnit 5 extension that does not start a full Quarkus application but merely the CDI container and the Configuration service. The lifecycle So when exactly does the QuarkusComponentTest start the CDI container? It depends on the value of @org.junit.jupiter.api.TestInstance#lifecycle . If the test instance lifecycle is Lifecycle#PER_METHOD (default) then the container is started during the before each test phase and stopped during the after each test phase. If the test instance lifecycle is Lifecycle#PER_CLASS` then the container is started during the before all test phase and stopped during the after all test phase. Components under test When writing a component test, it’s essential to understand how the set of tested components is built. It’s because the tested components are treated as real beans, but all unsatisfied dependencies are mocked automatically. What does it mean? Imagine that we have a bean Foo like this: package org.example; import jakarta.enterprise.context.ApplicationScoped; import jakarta.inject.Inject; @ApplicationScoped public class Foo { @Inject Charlie charlie; public String ping() { return charlie.ping(); } } It has one dependency - a bean Charlie . Now if you want to write a unit test for Foo you need to make sure the Charlie dependency is injected and functional. In QuarkusComponentTest , if you include Foo in the set of tested components but Charlie is not included, then a mock is automatically injected into Foo.charlie . What’s also important is that you can inject the mock directly in the test using the @InjectMock annotation and configure the mock in a test method: import static org.junit.jupiter.api.Assertions.assertEquals; import jakarta.inject.Inject; import io.quarkus.test.InjectMock; import io.quarkus.test.component.QuarkusComponentTest; import org.junit.jupiter.api.Test; import org.mockito.Mockito; @QuarkusComponentTest (1) public class FooTest { @Inject Foo foo; (2) @InjectMock Charlie charlieMock; (3) @Test public void testPing() { Mockito.when(charlieMock.ping()).thenReturn(\"OK\"); (4) assertEquals(\"OK\", foo.ping()); } } 1 The QuarkusComponentTest annotation registers the JUnit extension. 2 The test injects Foo - it’s included in the set of tested components. In other words, it’s treated as a real CDI bean. 3 The test also injects a mock for Charlie . Charlie is an unsatisfied dependency for which a synthetic @Singleton bean is registered automatically. The injected reference is an \"unconfigured\" Mockito mock. 4 We can leverage the Mockito API in a test method to configure the behavior. The initial set of tested components is derived from the test class: First, the types of all fields annotated with @jakarta.inject.Inject are considered the component types. The types of test methods parameters that are not annotated with @InjectMock , @SkipInject , or @org.mockito.Mock are also considered the component types. Finally, if @QuarkusComponentTest#addNestedClassesAsComponents() is set to true (it is by default) then all static nested classes declared on the test class are components too. Additional component classes can be set using @QuarkusComponentTest#value() or QuarkusComponentTestExtensionBuilder#addComponentClasses() .",
+    "quality_score": 8,
+    "modules": [
+      "java_patterns",
+      "clean_code",
+      "testing"
+    ]
+  },
+  {
+    "url": "https://quarkus.io/blog/building-large-applications/",
+    "title": "Towards faster builds",
+    "source_name": "Quarkus Blog",
+    "text": "This kind of journey naturally comes with its fair share of profiling and staring at flame graphs. It’s not just about spotting the hotspots, but also about evaluating whether your changes actually move the needle (in the right direction, hopefully!). In the Java world, we’ve been lucky to have a tool as powerful as Async Profiler by our side. As with any optimization effort, the key lies in choosing your battles wisely and carefully weighing the inevitable trade-offs. Code optimizations A lot of effort was invested in optimizing various parts of the build process: reducing memory allocations and optimizing algorithms and data structures were a big part of it. This work resulted in numerous pull requests across Quarkus, Jandex, and even ByteBuddy. Parallelization Our build process is already massively parallelized, but we identified a few areas where this was not the case, for example, the generation of Hibernate ORM proxies. We fixed that. Another area for improvement was the creation of large JAR archives, which is inherently slow because it involves reading and compressing a significant number of resources, making it both I/O- and CPU-intensive. Until now, we were building JARs using a ZipFileSystem, adding resources one by one in a single thread. We have since switched to using the parallel compression support provided by Commons Compress. This change required some fairly extensive refactoring of the JAR assembly code, but it was definitely worth it. Doing less All the other optimizations equally benefit Gradle builds, but the following change is specific to Maven as it relates to the Maven default lifecycle. With all these optimizations, the time spent in the various goals of the quarkus-maven-plugin was cut in half compared to our reference version, 3.25.1. That’s great…​ but building our sample application still took around two minutes, which is more than we would like. It’s time to step back and look at the bigger picture. For Quarkus applications, we build our own JARs for two main reasons: We need to include additional resources and metadata. We introduced custom JAR packagings designed to improve startup time. This is the process we optimized by leveraging the parallel compression support provided by Commons Compress. However, when using Maven, a Quarkus application is still a traditional jar Maven project. It follows the standard lifecycle for the jar packaging, which means Maven will also build a conventional JAR using the maven-jar-plugin . Taking a step back, we actually don’t need this JAR in 99% of cases, so we should avoid building it (while still keeping the flexibility to do so when absolutely necessary). In Quarkus 3.31, we introduced the quarkus packaging, which comes with its own lifecycle. This packaging is intended to be used only for the Quarkus application module itself. It automatically binds the goals of the quarkus-maven-plugin , resulting in less boilerplate in your pom.xml (and no changes required when new goals are added). More importantly, it does not bind the maven-jar-plugin execution, nor the maven-install-plugin , which leads to significantly faster builds for large applications, and benefits all applications overall. For newly generated applications, this new quarkus packaging will be the default. Once 3.31 is released, you will also be able to switch your existing applications to the new packaging by applying the following changes: diff --git a/pom.xml b/pom.xml index 98660b8..3c60220 100644 --- a/pom.xml +++ b/pom.xml @@ -5,6 +5,7 @@ <groupId>fr.spacefox.perftests.quarkus</groupId> <artifactId>perftests-quarkus</artifactId> <version>1.0.0-SNAPSHOT</version> + <packaging>quarkus</packaging> (1) <properties> <compiler-plugin.version>3.14.0</compiler-plugin.version> @@ -66,16 +67,6 @@ <artifactId>quarkus-maven-plugin</artifactId> <version>${quarkus.platform.version}</version> <extensions>true</extensions> (2) - <executions> (3) - <execution> - <goals> - <goal>build</goal> - <goal>generate-code</goal> - <goal>generate-code-tests</goal> - <goal>native-image-agent</goal> - </goals> - </execution> - </executions> </plugin> <plugin> <artifactId>maven-compiler-plugin</artifactId> 1 Use the quarkus packaging instead of the default jar packaging. 2 This is important and has been present in the generated projects for quite some time. Add it if not already there. 3 Drop the goals, they will be handled automatically and we don’t want to run them twice. To give you an idea of the impact, in our sample large application, this change alone reduced the build time from two minutes down to 37 seconds .",
+    "quality_score": 8,
+    "modules": [
+      "java_patterns",
+      "clean_code",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://quarkus.io/blog/k8s-style-CEL-with-quarkus-chicory/",
+    "title": "A Go CEL Policy Engine in Java, with Quarkus Chicory",
+    "source_name": "Quarkus Blog",
+    "text": "While iterating on development, we felt the need to implement an integration test based on a real world use case. After some research and experiments on popular scenarios we finally landed on a tasty one :-) A Kubernetes-style CEL Policy Engine CEL allows expression based policy validation of Kubernetes resources, and this requirement is implemented by operators…​ which are generally written in Go :-) But Quarkus Java based operators exist too - like the Keycloak operator - so what? Are we forced to implement a CEL policy validation engine in Java, from scratch? Or should we find a suitable Java library, for example https://github.com/projectnessie/cel-java ? None of the above: this is where Chicory, a WebAssembly runtime for Java, comes to help. Let’s just re-use a broadly used and well tested Go library, calling exported functions from Java, in a sandboxed, secure way, and be happy with it! Why? no rewrites low maintenance 1:1 behavior A Chicory extension for Quarkus applications Chicory is an open-source, 100% native Java WebAssembly (Wasm) runtime. Its primary goal is to allow Java developers to run Wasm modules within the JVM, without relying on native libraries, JNI (Java Native Interface) usage, or unsafe code. Unlike other Wasm runtimes that require platform-specific binaries, Chicory is pure Java. It executes Wasm code within the JVM’s memory space, providing a \"double sandbox\" effect (Wasm isolation + JVM security). It also provides WASI (WebAssembly System Interface) support, that allows Wasm modules to interact with system resources safely. Finally, it includes both an interpreter and a runtime compiler for quick execution, in addition to a build-time compiler that converts Wasm into Java bytecode for optimal performance, see Chicory execution modes . It is ideal for plugin systems, allowing users to write safe plugins in any language (Rust, C++, Go, etc.) that compiles to Wasm, and running them inside a Java app. It can be used for Serverless/Edge Computing cases, as it provides a mean to run lightweight logic on Java-based infrastructure without the overhead of application containers. And for something that never gets old, i.e. cross-platform portability, your application remains \"Write Once, Run Anywhere\" , without managing different .so or .dll files for different architectures. You can learn more about Chicory , but from now on let’s focus on its Quarkus extension, here. :-) Quarkus Chicory brings Chicory to Quarkus application developers, integrating its features into the Quarkus ecosystem and applications build-time and runtime peculiarities, for a natural developer experience. It just…​ works! Features Build-Time Code Generation Generates Java bytecode from WebAssembly modules, thus replacing the Chicory Maven plugin. Dependency Management Automatically handles version alignment between Quarkus and Chicory’s ASM dependencies. Multi WASM Module Support Configure and manage multiple WebAssembly modules. Dynamic Loading Manage runtime-loaded WASM modules. Intelligent Execution Mode Selection Configures the MachineFactory and WasmModule instances based on the environment. MachineFactory can leverage build-time generated bytecode for optimal performance in production/native, and use runtime or interpreter mode during development or test. Similarly, WasmModule instances can be initialized with WASM metadata rather than pure WASM payload, again for better performance and memory footprint, by leveraging the build-time code generation process. Live Reload in Development Static modules are automatically watched and reloaded. Think of everyone’s favorite quarkus:dev , but with Rust and Go modules Native Image Compatibility WASM/WASI support With such potential in our hands, we chose the popular Google CEL , a Go library/API adopted by several Go operators, and decided to integrate it in our application. Application setup and configuration Creating the application is straightforward using the Quarkus Maven plugin. Note that Quarkus 3.x requires Java 17 or higher (we used Java 21 for this example): mvn io.quarkus.platform:quarkus-maven-plugin:create \\ -DprojectGroupId=io.quarkiverse.chicory.demo \\ -DprojectArtifactId=quarkus-cel-k8s-validator \\ -Dextensions='rest' Next, we add the Quarkus Chicory extension to our pom.xml: <properties> <dylibso.version>1.6.1</dylibso.version> <quarkus-chicory.version>0.0.1</quarkus-chicory.version> </properties> <dependencyManagement> <dependencies> <dependency> <groupId>${quarkus.platform.group-id}</groupId> <artifactId>${quarkus.platform.artifact-id}</artifactId> <version>${quarkus.platform.version}</version> <type>pom</type> <scope>import</scope> </dependency> <dependency> <groupId>com.dylibso.chicory</groupId> <artifactId>wasi</artifactId> <version>${dylibso.version}</version> </dependency> <dependency> <groupId>io.quarkiverse.chicory</groupId> <artifactId>quarkus-chicory</artifactId> <version>${quarkus-chicory.version}</version> </dependency> </dependencies> </dependencyManagement> <dependencies> <dependency> <groupId>io.quarkus</groupId> <artifactId>quarkus-rest</artifactId> </dependency> <dependency> <groupId>io.quarkus</groupId> <artifactId>quarkus-rest-jackson</artifactId> </dependency> <dependency> <groupId>io.quarkus</groupId> <artifactId>quarkus-arc</artifactId> </dependency> <dependency> <groupId>io.quarkiverse.chicory</groupId> <artifactId>quarkus-chicory</artifactId> </dependency> <dependency> <groupId>com.dylibso.chicory</groupId> <artifactId>wasi</artifactId> </dependency> <!-- more dependencies here... --> </dependencies> Finally, the WASM module configuration goes in application.properties: quarkus.chicory.modules.go-cel.name=io.quarkiverse.chicory.demo.GoCelModule quarkus.chicory.modules.go-cel.wasm-file=src/main/resources/wasm/go-cel.wasm This tells Quarkus Chicory to generate a GoCelModule class at build time from the specified WASM file. The extension will automatically generate Java bytecode from the WebAssembly module, configure the appropriate MachineFactory based on the runtime environment, and - in development mode - watch the WASM file for changes to trigger live reload. First, let’s create a K8sCel Java class where to place our annotation: package io.quarkiverse.chicory.demo; import com.dylibso.chicory.annotations.WasmModuleInterface; @WasmModuleInterface(WasmResource.absoluteFile) public class K8sCel { private K8sCel() {} } At build-time, the Chicory annotation processor will discover such annotation and generate a K8sCel_ModuleExports class, which provides the exported methods: package io.quarkiverse.chicory.demo; import com.dylibso.chicory.runtime.ExportFunction; import com.dylibso.chicory.runtime.Instance; import com.dylibso.chicory.runtime.Memory; public class K8sCel_ModuleExports { private final ExportFunction field__start; private final ExportFunction field_malloc; private final ExportFunction field_free; private final ExportFunction field_evalPolicy; private final Memory field_memory; public K8sCel_ModuleExports(Instance instance) { this.field__start = instance.exports().function(\"_start\"); this.field_malloc = instance.exports().function(\"malloc\"); this.field_free = instance.exports().function(\"free\"); this.field_evalPolicy = instance.exports().function(\"evalPolicy\"); this.field_memory = instance.exports().memory(\"memory\"); } public void _start() { this.field__start.apply(new long[0]); } public int malloc(int arg0) { long result = this.field_malloc.apply(new long[]{(long)arg0})[0]; return (int)result; } public void free(int arg0) { this.field_free.apply(new long[]{(long)arg0}); } public int evalPolicy(int arg0, int arg1, int arg2, int arg3) { long result = this.field_evalPolicy.apply(new long[]{(long)arg0, (long)arg1, (long)arg2, (long)arg3})[0]; return (int)result; } public Memory memory() { return this.field_memory; } } And that’s enough! The WasmQuarkusContext API The example application follows a clean architecture pattern with separated concerns: K8sCelValidatorService - Manages WASM integration and business logic K8sCelValidatorResource - Provides REST API endpoint The Quarkus Chicory extension provides the WasmQuarkusContext API for injection, to access configured WASM modules. Here’s how we use it in our service: @ApplicationScoped public class K8sCelValidatorService { @Inject @Named(\"go-cel\") WasmQuarkusContext wasmQuarkusContext; Instance instance; K8sCel_ModuleExports exports; @PostConstruct public void init() throws IOException { WasmModule wasmModule = wasmQuarkusContext.getWasmModule(); if (wasmModule == null) { throw new IllegalStateException(\"Wasm module \" + wasmQuarkusContext.getName() + \" not found!\"); } // Create WASI support for stdout/stderr WasiOptions options = WasiOptions.builder() .withStdout(new ByteArrayOutputStream()) .withStderr(new ByteArrayOutputStream()) .build(); WasiPreview1 wasi = WasiPreview1.builder() .withOptions(options) .build(); Store store = new Store().addFunction(wasi.toHostFunctions()); instance = Instance.builder(wasmModule) (1) .withMachineFactory(wasmQuarkusContext.getMachineFactory()) .withImportValues(store.toImportValues()) // Don't auto-run _start(), we'll call it manually .withStart(false) .build(); // Get exported functions BEFORE calling _start exports = new K8sCel_ModuleExports(instance); (2) // Initialize Go runtime by calling _start() // This is required to perform initialization, i.e. to run main(), which indeed should exit with 0, // so we catch the expected WasiExitException accordingly. try { exports.start(); (3) } catch (com.dylibso.chicory.wasi.WasiExitException e) { // Expected - Go main() exits after completing if (e.exitCode() != 0) { throw new RuntimeException(\"Go runtime initialization failed with exit code: \" + e.exitCode()); } // Exit code 0 is success - runtime is now initialized and exported functions are ready } } public ValidationResult validate(final String resourceJson, final String celPolicy) { byte[] policyBytes = celPolicy.getBytes(StandardCharsets.UTF_8); byte[] inputBytes = resourceJson.getBytes(StandardCharsets.UTF_8); // Allocate memory for policy string in WASM int policyPtr = exports.malloc(policyBytes.length); if (policyPtr == 0) { throw new IllegalStateException(\"Failed to allocate memory for policy\"); } // Allocate memory for input JSON in WASM int inputPtr = exports.malloc(inputBytes.length); if (inputPtr == 0) { throw new IllegalStateException(\"Failed to allocate memory for input\"); } try { // Write policy and input to WASM memory exports.memory().write(policyPtr, policyBytes); exports.memory().write(inputPtr, inputBytes); // Call evalPolicy(policyPtr, policyLen, inputPtr, inputLen) int returnCode = exports.evalPolicy(policyPtr, policyBytes.length, inputPtr, inputBytes.length); // Interpret result if (returnCode == 11) { return new ValidationResult(VALIDATION_RESULT_ALLOWED, \"Policy ALLOWS the request\", celPolicy); } else if (returnCode == 0) { return new ValidationResult(VALIDATION_RESULT_DENIED, \"Policy DENIES the request\", celPolicy); } else { // Negative values are errors String errorMsg = switch (returnCode) { case -1 -> \"JSON parse error\"; case -2 -> \"CEL environment creation error\"; case -3 -> \"CEL compilation error\"; case -4 -> \"CEL program creation error\"; case -5 -> \"CEL runtime error\"; default -> \"Unknown error: \" + returnCode; }; return new ValidationResult(VALIDATION_RESULT_ERROR, \"CEL evaluation failed: \" + errorMsg, celPolicy); } } finally { // Free allocated memory in WASM exports.free(policyPtr); exports.free(inputPtr); } } public static final String VALIDATION_RESULT_ALLOWED = \"allowed\"; public static final String VALIDATION_RESULT_DENIED = \"denied\"; public static final String VALIDATION_RESULT_ERROR = \"error\"; public record ValidationResult(String status, String message, String policy) {} } 1 The injected WasmQuarkusContext bean configures Instance.Builder to use MachineFactory and WasmModule instances, which are created dynamically, based on the application configuration and execution environment. 2 Once instance is built, export is initialized with a K8sCel_ModuleExports instance, providing exported functions which are called later in the validate() method. 3 The exported \"_start\" function is called, to initialize the Go runtime. This executes the Go program main() function. As it’s empty in our implementation, it will exit immediately, so we catch WasiExitExcpetion to check for a 0 (no errors) exit code. A note about multi-user and thread safety WasmQuarkusContext instances are injected as @ApplicationScoped beans. This means that a unique application instance can be used by several clients (or user requests) and threads. That being said, the API implementation is stateless , i.e. getMachineFactory() and getWasmModule() always return new instances. The way such instances are dealt with, and how their lifecycle is orchestrated, is something that pertains to the application domain. For example, the above implementation doesn’t take concurrency into account. If multiple threads are going to consume the same Memory instance, a thread-safe implementation would be required in order to avoid corrupting the shared WasmModule linear memory. Back to our application code, the REST resource is then a simple delegation layer: @Path(\"/k8s\") public class K8sCelValidatorResource { @Inject K8sCelValidatorService validatorService; @POST @Path(\"/validate\") public Response validate(@RestForm String resourceJson, @RestForm String celPolicy) { ValidationResult result = validatorService.validate(resourceJson, celPolicy); Response.Status status = switch (result.status()) { case \"allowed\" -> Response.Status.OK; case \"denied\" -> Response.Status.FORBIDDEN; default -> Response.Status.BAD_REQUEST; }; return Response.status(status).entity(result).build(); } } The WasmQuarkusContext API provides two key methods: getWasmModule() : returns the parsed WebAssembly module getMachineFactory() : returns the appropriate MachineFactory based on environment (interpreter for dev, build-time compilation for production/native) The @Named qualifier matches the module name from application.properties. The extension handles all the complexity of WASM module lifecycle, allowing us to focus on the business logic. How it works: Go → Wasm → Java bytecode The heart of our application is the Go CEL implementation, compiled to WebAssembly. The Go code implements three key exported functions: //go:wasmexport evalPolicy func evalPolicy(policyPtr, policyLen, inputPtr, inputLen uint32) int32 { // Convert pointers to Go types policy := unsafe.String((*byte)(unsafe.Pointer(uintptr(policyPtr))), policyLen) inputJSON := unsafe.Slice((*byte)(unsafe.Pointer(uintptr(inputPtr))), inputLen) // Parse the JSON input var input map[string]any if err := json.Unmarshal(inputJSON, &input); err != nil { return -1 // JSON parse error } // Create CEL environment env, err := cel.NewEnv( cel.Declarations( decls.NewVar(\"object\", decls.NewMapType(decls.String, decls.Dyn)), ), ) if err != nil { return -2 // CEL environment creation error } // Compile and evaluate the CEL expression ast, iss := env.Compile(policy) if iss.Err() != nil { return -3 // Compilation error } prg, err := env.Program(ast) if err != nil { return -4 // Program creation error } out, _, err := prg.Eval(map[string]any{\"object\": input}) if err != nil { return -5 // CEL runtime error } // Return 1 for allow, 0 for deny if b, ok := out.Value().(bool); ok && b { return 1 } return 0 } This Go code is compiled to WASM using the WASI target: GOOS=wasip1 GOARCH=wasm go build -o go-cel.wasm main.go In our service implementation: Java allocates WASM memory for the policy string and input resource manifest (JSON), and writes the data to WASM memory Java calls evalPolicy() with pointers to arguments and their size Go code reads from its memory space, and evaluates the CEL expression using the Google CEL library Go returns an integer result code (1=allow, 0=deny, negative=error) Java interprets the result and performs clean up This demonstrates the power of WebAssembly: we can use the mature, battle-tested Google CEL-Go library from Java without reimplementing CEL from scratch. The WASM boundary provides a clean and safe interface between the two languages. In production, we can write CEL policies that validate Kubernetes resources just like Go operators do: // Require production label has(object.metadata.labels.env) && object.metadata.labels.env == \"production\" // Deny privileged containers !(has(object.spec.containers) && object.spec.containers.exists(c, has(c.securityContext) && c.securityContext.privileged == true)) // Require resource limits has(object.spec.containers) && object.spec.containers.all(c, has(c.resources) && has(c.resources.limits)) Conclusion By combining Quarkus Chicory with Google CEL-Go compiled to WebAssembly, we’ve created a Kubernetes-style CEL policy engine that runs entirely in Java. This approach offers several benefits: Reuse existing Go libraries: No need to reimplement CEL in Java, 1:1 mapping with original Go code Type safety and performance: Quarkus Chicory generates Java bytecode from WASM modules Production ready: The same CEL library used by Go operators, now available in Java Developer experience: Live reload, build-time code generation, and native image support Ecosystem compatibility: Works seamlessly with Java-based Kubernetes operators This demonstrates that WebAssembly is not just a browser technology, but rather a powerful tool for cross-language interoperability in cloud-native applications, and showcases how to integrate this workflow easily in Quarkus applications, thanks to Quarkus Chicory. For Java developers building Kubernetes operators, this approach opens up a large part of the Go ecosystem without leaving the JVM.",
+    "quality_score": 9,
+    "modules": [
+      "java_patterns",
+      "design_patterns",
+      "integration"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2025/10/01/react-19-2",
+    "title": "React 19.2",
+    "source_name": "React Blog",
+    "text": "October 1, 2025 by The React Team React 19.2 is now available on npm! This is our third release in the last year, following React 19 in December and React 19.1 in June. In this post, we’ll give an overview of the new features in React 19.2, and highlight some notable changes. New React Features <Activity /> useEffectEvent cacheSignal Performance Tracks New React DOM Features Partial Pre-rendering Notable Changes Batching Suspense Boundaries for SSR SSR: Web Streams support for Node eslint-plugin-react-hooks v6 Update the default useId prefix Changelog New React Features <Activity /> <Activity> lets you break your app into “activities” that can be controlled and prioritized. You can use Activity as an alternative to conditionally rendering parts of your app: // Before { isVisible && < Page /> } // After < Activity mode = { isVisible ? 'visible' : 'hidden' } > < Page /> </ Activity > In React 19.2, Activity supports two modes: visible and hidden . hidden : hides the children, unmounts effects, and defers all updates until React has nothing left to work on. visible : shows the children, mounts effects, and allows updates to be processed normally. This means you can pre-render and keep rendering hidden parts of the app without impacting the performance of anything visible on screen. You can use Activity to render hidden parts of the app that a user is likely to navigate to next, or to save the state of parts the user navigates away from. This helps make navigations quicker by loading data, css, and images in the background, and allows back navigations to maintain state such as input fields. In the future, we plan to add more modes to Activity for different use cases. For examples on how to use Activity, check out the Activity docs . useEffectEvent One common pattern with useEffect is to notify the app code about some kind of “events” from an external system. For example, when a chat room gets connected, you might want to display a notification: function ChatRoom ( { roomId , theme } ) { useEffect ( ( ) => { const connection = createConnection ( serverUrl , roomId ) ; connection . on ( 'connected' , ( ) => { showNotification ( 'Connected!' , theme ) ; } ) ; connection . connect ( ) ; return ( ) => { connection . disconnect ( ) } ; } , [ roomId , theme ] ) ; // ... The problem with the code above is that a change to any values used inside such an “event” will cause the surrounding Effect to re-run. For example, changing the theme will cause the chat room to reconnect. This makes sense for values related to the Effect logic itself, like roomId , but it doesn’t make sense for theme . To solve this, most users just disable the lint rule and exclude the dependency. But that can lead to bugs since the linter can no longer help you keep the dependencies up to date if you need to update the Effect later. With useEffectEvent , you can split the “event” part of this logic out of the Effect that emits it: function ChatRoom ( { roomId , theme } ) { const onConnected = useEffectEvent ( ( ) => { showNotification ( 'Connected!' , theme ) ; } ) ; useEffect ( ( ) => { const connection = createConnection ( serverUrl , roomId ) ; connection . on ( 'connected' , ( ) => { onConnected ( ) ; } ) ; connection . connect ( ) ; return ( ) => connection . disconnect ( ) ; } , [ roomId ] ) ; // ✅ All dependencies declared (Effect Events aren't dependencies) // ... Similar to DOM events, Effect Events always “see” the latest props and state. Effect Events should not be declared in the dependency array . You’ll need to upgrade to eslint-plugin-react-hooks@latest so that the linter doesn’t try to insert them as dependencies. Note that Effect Events can only be declared in the same component or Hook as “their” Effect. These restrictions are verified by the linter. Note When to use useEffectEvent You should use useEffectEvent for functions that are conceptually “events” that happen to be fired from an Effect instead of a user event (that’s what makes it an “Effect Event”). You don’t need to wrap everything in useEffectEvent , or to use it just to silence the lint error, as this can lead to bugs. For a deep dive on how to think about Event Effects, see: Separating Events from Effects . cacheSignal cacheSignal allows you to know when the cache() lifetime is over: import { cache , cacheSignal } from 'react' ; const dedupedFetch = cache ( fetch ) ; async function Component ( ) { await dedupedFetch ( url , { signal : cacheSignal ( ) } ) ; } This allows you to clean up or abort work when the result will no longer be used in the cache, such as: React has successfully completed rendering The render was aborted The render has failed For more info, see the cacheSignal docs . Performance Tracks React 19.2 adds a new set of custom tracks to Chrome DevTools performance profiles to provide more information about the performance of your React app: The React Performance Tracks docs explain everything included in the tracks, but here is a high-level overview. Scheduler ⚛ The Scheduler track shows what React is working on for different priorities such as “blocking” for user interactions, or “transition” for updates inside startTransition. Inside each track, you will see the type of work being performed such as the event that scheduled an update, and when the render for that update happened. We also show information such as when an update is blocked waiting for a different priority, or when React is waiting for paint before continuing. The Scheduler track helps you understand how React splits your code into different priorities, and the order it completed the work. See the Scheduler track docs to see everything included. Components ⚛ The Components track shows the tree of components that React is working on either to render or run effects. Inside you’ll see labels such as “Mount” for when children mount or effects are mounted, or “Blocked” for when rendering is blocked due to yielding to work outside React. The Components track helps you understand when components are rendered or run effects, and the time it takes to complete that work to help identify performance problems. See the Components track docs for see everything included. New React DOM Features Partial Pre-rendering In 19.2 we’re adding a new capability to pre-render part of the app ahead of time, and resume rendering it later. This feature is called “Partial Pre-rendering”, and allows you to pre-render the static parts of your app and serve it from a CDN, and then resume rendering the shell to fill it in with dynamic content later. To pre-render an app to resume later, first call prerender with an AbortController : const { prelude , postponed } = await prerender ( < App /> , { signal : controller . signal , } ) ; // Save the postponed state for later await savePostponedState ( postponed ) ; // Send prelude to client or CDN. Then, you can return the prelude shell to the client, and later call resume to “resume” to a SSR stream: const postponed = await getPostponedState ( request ) ; const resumeStream = await resume ( < App /> , postponed ) ; // Send stream to client. Or you can call resumeAndPrerender to resume to get static HTML for SSG: const postponedState = await getPostponedState ( request ) ; const { prelude } = await resumeAndPrerender ( < App /> , postponedState ) ; // Send complete HTML prelude to CDN. For more info, see the docs for the new APIs: react-dom/server resume : for Web Streams. resumeToPipeableStream for Node Streams. react-dom/static resumeAndPrerender for Web Streams. resumeAndPrerenderToNodeStream for Node Streams. Additionally, the prerender apis now return a postpone state to pass to the resume apis. Notable Changes Batching Suspense Boundaries for SSR We fixed a behavioral bug where Suspense boundaries would reveal differently depending on if they were rendered on the client or when streaming from server-side rendering. Starting in 19.2, React will batch reveals of server-rendered Suspense boundaries for a short time, to allow more content to be revealed together and align with the client-rendered behavior. Previously, during streaming server-side rendering, suspense content would immediately replace fallbacks. In React 19.2, suspense boundaries are batched for a small amount of time, to allow revealing more content together. This fix also prepares apps for supporting <ViewTransition> for Suspense during SSR. By revealing more content together, animations can run in larger batches of content, and avoid chaining animations of content that stream in close together. Note React uses heuristics to ensure throttling does not impact core web vitals and search ranking. For example, if the total page load time is approaching 2.5s (which is the time considered “good” for LCP ), React will stop batching and reveal content immediately so that the throttling is not the reason to miss the metric. SSR: Web Streams support for Node React 19.2 adds support for Web Streams for streaming SSR in Node.js: renderToReadableStream is now available for Node.js prerender is now available for Node.js As well as the new resume APIs: resume is available for Node.js. resumeAndPrerender is available for Node.js. eslint-plugin-react-hooks v6 We also published eslint-plugin-react-hooks@latest with flat config by default in the recommended preset, and opt-in for new React Compiler powered rules. To continue using the legacy config, you can change to recommended-legacy : - extends : [ 'plugin:react-hooks/recommended' ] + extends : [ 'plugin:react-hooks/recommended-legacy' ] For a full list of compiler enabled rules, check out the linter docs . Check out the eslint-plugin-react-hooks changelog for a full list of changes . Update the default useId prefix In 19.2, we’re updating the default useId prefix from :r: (19.0.0) or «r» (19.1.0) to _r_ . The original intent of using a special character that was not valid for CSS selectors was that it would be unlikely to collide with IDs written by users. However, to support View Transitions, we need to ensure that IDs generated by useId are valid for view-transition-name and XML 1.0 names. Changelog Other notable changes react-dom : Allow nonce to be used on hoistable styles #32461 react-dom : Warn for using a React owned node as a Container if it also has text content #32774 Notable bug fixes react : Stringify context as “SomeContext” instead of “SomeContext.Provider” #33507 react : Fix infinite useDeferredValue loop in popstate event #32821 react : Fix a bug when an initial value was passed to useDeferredValue #34376 react : Fix a crash when submitting forms with Client Actions #33055 react : Hide/unhide the content of dehydrated suspense boundaries if they resuspend #32900 react : Avoid stack overflow on wide trees during Hot Reload #34145 react : Improve component stacks in various places #33629 , #33724 , #32735 , #33723 react : Fix a bug with React.use inside React.lazy-ed Component #33941 react-dom : Stop warning when ARIA 1.3 attributes are used #34264 react-dom : Fix a bug with deeply nested Suspense inside Suspense fallbacks #33467 react-dom : Avoid hanging when suspending after aborting while rendering #34192 For a full list of changes, please see the Changelog . Thanks to Ricky Hanlon for writing this post , Dan Abramov , Matt Carroll , Jack Pope , and Joe Savona for reviewing this post.",
+    "quality_score": 9,
+    "modules": [
+      "react_patterns",
+      "js_advanced",
+      "performance"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components",
+    "title": "Critical Security Vulnerability in React Server Components",
+    "source_name": "React Blog",
+    "text": "December 3, 2025 by The React Team There is an unauthenticated remote code execution vulnerability in React Server Components. We recommend upgrading immediately. On November 29th, Lachlan Davidson reported a security vulnerability in React that allows unauthenticated remote code execution by exploiting a flaw in how React decodes payloads sent to React Server Function endpoints. Even if your app does not implement any React Server Function endpoints it may still be vulnerable if your app supports React Server Components. This vulnerability was disclosed as CVE-2025-55182 and is rated CVSS 10.0. The vulnerability is present in versions 19.0, 19.1.0, 19.1.1, and 19.2.0 of: react-server-dom-webpack react-server-dom-parcel react-server-dom-turbopack Immediate Action Required A fix was introduced in versions 19.0.1 , 19.1.2 , and 19.2.1 . If you are using any of the above packages please upgrade to any of the fixed versions immediately. If your app’s React code does not use a server, your app is not affected by this vulnerability. If your app does not use a framework, bundler, or bundler plugin that supports React Server Components, your app is not affected by this vulnerability. Affected frameworks and bundlers Some React frameworks and bundlers depended on, had peer dependencies for, or included the vulnerable React packages. The following React frameworks & bundlers are affected: next , react-router , waku , @parcel/rsc , @vitejs/plugin-rsc , and rwsdk . See the update instructions below for how to upgrade to these patches. Hosting Provider Mitigations We have worked with a number of hosting providers to apply temporary mitigations. You should not depend on these to secure your app, and still update immediately. Vulnerability overview React Server Functions allow a client to call a function on a server. React provides integration points and tools that frameworks and bundlers use to help React code run on both the client and the server. React translates requests on the client into HTTP requests which are forwarded to a server. On the server, React translates the HTTP request into a function call and returns the needed data to the client. An unauthenticated attacker could craft a malicious HTTP request to any Server Function endpoint that, when deserialized by React, achieves remote code execution on the server. Further details of the vulnerability will be provided after the rollout of the fix is complete. Update Instructions Next.js All users should upgrade to the latest patched version in their release line: npm install next @14 .2 . 35 // for 13.3.x, 13.4.x, 13.5.x, 14.x npm install next @ 15.0 .8 // for 15.0.x npm install next @15 .1 . 12 // for 15.1.x npm install next @ 15.2 .9 // for 15.2.x npm install next @15 .3 . 9 // for 15.3.x npm install next @ 15.4 .11 // for 15.4.x npm install next @15 .5 . 10 // for 15.5.x npm install next @ 16.0 .11 // for 16.0.x npm install next @16 .1 . 5 // for 16.1.x npm install next @ 15.6 .0 - canary . 60 // for 15.x canary releases npm install next @ 16.1 .0 - canary . 19 // for 16.x canary releases 15.0.8, 15.1.12, 15.2.9, 15.3.9, 15.4.10, 15.5.10, 15.6.0-canary.61, 16.0.11, 16.1.5 If you are on version 13.3 or later version of Next.js 13 ( 13.3.x , 13.4.x , or 13.5.x ) please upgrade to version 14.2.35 . If you are on next@14.3.0-canary.77 or a later canary release, downgrade to the latest stable 14.x release: npm install next @14 See the Next.js blog for the latest update instructions and the previous changelog for more info. React Router If you are using React Router’s unstable RSC APIs, you should upgrade the following package.json dependencies if they exist: npm install react @ latest npm install react - dom @ latest npm install react - server - dom - parcel @ latest npm install react - server - dom - webpack @ latest npm install @ vitejs /plugin-rsc@latest Expo To learn more about mitigating, read the article on expo.dev/changelog . Redwood SDK Ensure you are on rwsdk>=1.0.0-alpha.0 For the latest beta version: npm install rwsdk @latest Upgrade to the latest react-server-dom-webpack : npm install react @ latest react - dom @ latest react - server - dom - webpack @latest See Redwood docs for more migration instructions. Waku Upgrade to the latest react-server-dom-webpack : npm install react @ latest react - dom @ latest react - server - dom - webpack @ latest waku@ latest See Waku announcement for more migration instructions. @vitejs/plugin-rsc Upgrade to the latest RSC plugin: npm install react @ latest react - dom @ latest @ vitejs /plugin-rsc@latest react-server-dom-parcel Update to the latest version: npm install react @ latest react - dom @ latest react - server - dom - parcel @latest react-server-dom-turbopack Update to the latest version: npm install react @ latest react - dom @ latest react - server - dom - turbopack @latest react-server-dom-webpack Update to the latest version: npm install react @ latest react - dom @ latest react - server - dom - webpack @latest React Native For React Native users not using a monorepo or react-dom , your react version should be pinned in your package.json , and there are no additional steps needed. If you are using React Native in a monorepo, you should update only the impacted packages if they are installed: react-server-dom-webpack react-server-dom-parcel react-server-dom-turbopack This is required to mitigate the security advisory, but you do not need to update react and react-dom so this will not cause the version mismatch error in React Native. See this issue for more information. Timeline November 29th : Lachlan Davidson reported the security vulnerability via Meta Bug Bounty . November 30th : Meta security researchers confirmed and began working with the React team on a fix. December 1st : A fix was created and the React team began working with affected hosting providers and open source projects to validate the fix, implement mitigations and roll out the fix December 3rd : The fix was published to npm and the publicly disclosed as CVE-2025-55182. Attribution Thank you to Lachlan Davidson for discovering, reporting, and working to help fix this vulnerability.",
+    "quality_score": 8,
+    "modules": [
+      "react_patterns",
+      "dependency_health",
+      "security"
+    ]
+  },
+  {
+    "url": "https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/",
+    "title": "Our plan for a more secure npm supply chain",
+    "source_name": "The GitHub Blog",
+    "text": "Addressing a surge in package registry attacks, GitHub is strengthening npm’s security with stricter authentication, granular tokens, and enhanced trusted publishing to restore trust in the open source ecosystem. September 22, 2025 | 4 minutes Share: Open source software is the bedrock of the modern software industry. Its collaborative nature and vast ecosystem empower developers worldwide, driving efficiency and progress at an unprecedented scale. This scale also presents unique vulnerabilities that are continually tested and under attack by malicious actors, making the security of open source a critical concern for all. Transparency is central to maintaining community trust. Today, we’re sharing details of recent npm registry incidents, the actions we took towards remediation, and how we’re continuing to invest in npm security. Recent attacks on the open source ecosystem The software industry has faced a recent surge in damaging account takeovers on package registries, including npm. These ongoing attacks have allowed malicious actors to gain unauthorized access to maintainer accounts and subsequently distribute malicious software through well-known, trusted packages. On September 14, 2025, we were notified of the Shai-Hulud attack , a self-replicating worm that infiltrated the npm ecosystem via compromised maintainer accounts by injecting malicious post-install scripts into popular JavaScript packages. By combining self-replication with the capability to steal multiple types of secrets (and not just npm tokens), this worm could have enabled an endless stream of attacks had it not been for timely action from GitHub and open source maintainers. In direct response to this incident, GitHub has taken swift and decisive action including: Immediate removal of 500+ compromised packages from the npm registry to prevent further propagation of malicious software. npm blocking the upload of new packages containing the malware’s IoCs (Indicators of Compromise), cutting off the self-replicating pattern. Such breaches erode trust in the open source ecosystem and pose a direct threat to the integrity and security of the entire software supply chain. They also highlight why raising the bar on authentication and secure publishing practices is essential to strengthening the npm ecosystem against future attacks. npm’s roadmap for hardening package publication GitHub is committed to investigating these threats and mitigating the risks that they pose to the open source community. To address token abuse and self-replicating malware, we will be changing authentication and publishing options in the near future to only include: Local publishing with required two-factor authentication (2FA). Granular tokens which will have a limited lifetime of seven days. Trusted publishing . To support these changes and further improve the security of the npm ecosystem, we will: Deprecate legacy classic tokens. Deprecate time-based one-time password (TOTP) 2FA, migrating users to FIDO-based 2FA. Limit granular tokens with publishing permissions to a shorter expiration. Set publishing access to disallow tokens by default, encouraging usage of trusted publishers or 2FA enforced local publishing. Remove the option to bypass 2FA for local package publishing. Expand eligible providers for trusted publishing. We recognize that some of the security changes we are making may require updates to your workflows. We are going to roll these changes out gradually to ensure we minimize disruption while strengthening the security posture of npm. We’re committed to supporting you through this transition and will provide future updates with clear timelines, documentation, migration guides, and support channels. Strengthening the ecosystem with trusted publishing Trusted publishing is a recommended security capability by the OpenSSF Securing Software Repositories Working Group as it removes the need to securely manage an API token in the build system. It was pioneered by PyPI in April 2023 as a way to get API tokens out of build pipelines. Since then, trusted publishing has been added to RubyGems ( December 2023 ), crates.io ( July 2025 ), npm (also July 2025 ), and most recently NuGet ( September 2025 ), as well as other package repositories. When npm released support for trusted publishing, it was our intention to let adoption of this new feature grow organically. However, attackers have shown us that they are not waiting. We strongly encourage projects to adopt trusted publishing as soon as possible, for all supported package managers. Actions that npm maintainers can take today These efforts, from GitHub and the broader software community, underscore our global commitment to fortifying the security of the software supply chain. The security of the ecosystem is a shared responsibility, and we’re grateful for the vigilance and collaboration of the open source community. Here are the actions npm maintainers can take now: Use npm trusted publishing instead of tokens. Strengthen publishing settings on accounts, orgs, and packages to require 2FA for any writes and publishing actions. When configuring two-factor authentication , use WebAuthn instead of TOTP. True resilience requires the active participation and vigilance of everyone in the software industry. By adopting robust security practices, leveraging available tools, and contributing to these collective efforts, we can collectively build a more secure and trustworthy open source ecosystem for all. Written by Sr. Dir, Security Research. Open Source Security at GitHub. I lead the GitHub Security Lab, empowering open source maintainers and developers to ship secure software. Related posts We do newsletters, too Discover tips, technical guides, and best practices in our biweekly newsletter just for devs. Your email address",
+    "quality_score": 8,
+    "modules": [
+      "dependency_health",
+      "security",
+      "devops"
+    ]
   }
 ]

```

### Commit 2: 1591f42
**Message:** feat: add kms-backed tenant token encryption

**Diff:**
```diff
--- docs/adr/ADR-002-envelope-encryption-kms.md
diff --git a/docs/adr/ADR-002-envelope-encryption-kms.md b/docs/adr/ADR-002-envelope-encryption-kms.md
index 00ebec2..8e21e22 100644
--- a/docs/adr/ADR-002-envelope-encryption-kms.md
+++ b/docs/adr/ADR-002-envelope-encryption-kms.md
@@ -2,7 +2,7 @@
 
 | Field | Value |
 |-------|-------|
-| Status | Accepted |
+| Status | Accepted, implemented on `feat/content-intelligence` |
 | Date | 2026-04-08 |
 | Deciders | Liliana Castellanos |
 
@@ -42,7 +42,49 @@ Two options were considered:
 in the DB contract. Only the storage adapter and a decryption step in `processJob` change.
 `TenantRow` interface in `process-job.ts` is unchanged.
 
-**Not yet implemented.** Required before paid tier launch.
+**Implementation status:** The envelope encryption flow now exists in the app code:
+- new tokens are encrypted before being written from onboarding / OAuth callbacks
+- worker and scanner decrypt tokens at runtime using GCP KMS
+- a rotation script exists to re-encrypt legacy plaintext rows already stored in Supabase
+
+Rollout is still required before paid tier launch.
+
+## Why Rotation Is Required
+
+Rotation is needed because existing tenants were created before envelope encryption was added.
+Those rows already contain plaintext tokens in:
+
+- `tenants.buffer_access_token`
+- `tenants.linkedin_access_token`
+
+After the new code is deployed:
+- new or reconnected tenants will be stored encrypted automatically
+- old tenants would continue working temporarily only because the runtime keeps a legacy
+  fallback for plaintext rows during rollout
+
+That fallback is deliberate and temporary. Rotation is what removes the remaining plaintext
+secrets from the database without forcing every tenant to reconnect manually.
+
+So the purpose of rotation is:
+- eliminate pre-existing plaintext tokens from Supabase
+- make the database consistent: all tenants have `encrypted_dek` + ciphertext tokens
+- let us remove the legacy plaintext fallback later with confidence
+- satisfy the "required before launch" security requirement in the master spec
+
+## Rollout Shape
+
+Safe rollout order:
+
+1. Apply the DB migration that adds `tenants.encrypted_dek`
+2. Create the KMS key and grant runtime IAM permissions
+3. Deploy the new code with `GCP_KMS_KEY_NAME`
+4. Run the rotation script against existing tenants
+5. Smoke-test publish + scanner with a real tenant
+
+This order avoids downtime:
+- pre-rotation tenants still work because the runtime tolerates plaintext rows
+- post-deploy writes are encrypted immediately
+- rotation backfills the rest in place
 
 ## Consequences
 
@@ -62,3 +104,12 @@ in the DB contract. Only the storage adapter and a decryption step in `processJo
   a key deletion policy (30-day scheduled deletion minimum in GCP KMS).
 - `encrypted_dek` is a new column in `tenants` — requires a migration that also
   re-encrypts any existing plaintext tokens during rollout.
+
+## Operational Notes
+
+- The runtime expects `GCP_KMS_KEY_NAME` (or legacy alias `KMS_KEY_NAME`) to contain the full
+  crypto key resource name, for example:
+  `projects/<project>/locations/<location>/keyRings/<keyring>/cryptoKeys/<key>`
+- The local rotation script uses the same env var and Google Application Default Credentials.
+- Rotation should be run first with `--dry-run`, then without it once the candidate set looks
+  correct.


--- docs/phase2-launch-runbook.md
diff --git a/docs/phase2-launch-runbook.md b/docs/phase2-launch-runbook.md
new file mode 100644
index 0000000..99479fb
--- /dev/null
+++ b/docs/phase2-launch-runbook.md
@@ -0,0 +1,254 @@
+# Phase 2 Launch Runbook
+
+Step-by-step commands to close Phase 2 and deploy `feat/content-intelligence` safely.
+
+This runbook assumes:
+- GCP project: `lilicurl`
+- Cloud Run region: `us-central1`
+- Supabase migration for Phase 2 is already applied
+- seed corpus is already loaded
+
+## 1. Prepare local variables
+
+```bash
+cd /Users/Lilicurl/Documents/git/social-engagement
+
+export PROJECT_ID="lilicurl"
+export REGION="us-central1"
+export KMS_LOCATION="global"
+export KMS_KEYRING="devcast"
+export KMS_KEY="tenant-secrets"
+export GCP_KMS_KEY_NAME="projects/${PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}"
+```
+
+If you already use a different KMS location or key name, replace the variables above.
+
+## 2. Create the KMS key (skip if it already exists)
+
+```bash
+gcloud kms keyrings create "${KMS_KEYRING}" \
+  --location="${KMS_LOCATION}" \
+  --project="${PROJECT_ID}"
+
+gcloud kms keys create "${KMS_KEY}" \
+  --location="${KMS_LOCATION}" \
+  --keyring="${KMS_KEYRING}" \
+  --purpose="encryption" \
+  --project="${PROJECT_ID}"
+```
+
+Verify:
+
+```bash
+gcloud kms keys describe "${KMS_KEY}" \
+  --location="${KMS_LOCATION}" \
+  --keyring="${KMS_KEYRING}" \
+  --project="${PROJECT_ID}"
+```
+
+## 3. Discover which service accounts are running the app
+
+```bash
+export WEBHOOK_SA="$(gcloud run services describe getdevcast-webhook \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --format='value(spec.template.spec.serviceAccountName)')"
+
+export WORKER_SA="$(gcloud run jobs describe devcast-worker \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --format='value(spec.template.template.spec.serviceAccountName)')"
+
+export SCANNER_SA="$(gcloud run jobs describe devcast-scanner \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --format='value(spec.template.template.spec.serviceAccountName)')"
+
+printf 'webhook=%s\nworker=%s\nscanner=%s\n' "$WEBHOOK_SA" "$WORKER_SA" "$SCANNER_SA"
+```
+
+If `WORKER_SA` or `SCANNER_SA` prints empty / `null`, the job is not using an explicit
+service account and will typically inherit the project's default Compute Engine service
+account. In that case, granting KMS access to the same default service account used by
+the webhook is sufficient.
+
+## 4. Grant KMS permissions
+
+Grant runtime access to each Cloud Run service account:
+
+```bash
+for SA in "$WEBHOOK_SA" "$WORKER_SA" "$SCANNER_SA"; do
+  gcloud kms keys add-iam-policy-binding "${KMS_KEY}" \
+    --location="${KMS_LOCATION}" \
+    --keyring="${KMS_KEYRING}" \
+    --project="${PROJECT_ID}" \
+    --member="serviceAccount:${SA}" \
+    --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
+done
+```
+
+If the worker/scanner variables are empty, run the binding only for the non-empty service
+account instead of looping over blank values.
+
+Grant the same role to the identity that will run the local rotation script.
+If you run it with your own user credentials:
+
+```bash
+gcloud kms keys add-iam-policy-binding "${KMS_KEY}" \
+  --location="${KMS_LOCATION}" \
+  --keyring="${KMS_KEYRING}" \
+  --project="${PROJECT_ID}" \
+  --member="user:<your-google-email>" \
+  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
+```
+
+## 5. Authenticate local ADC for the rotation script
+
+```bash
+gcloud auth application-default login
+```
+
+If you use a service account key locally instead, export `GOOGLE_APPLICATION_CREDENTIALS`.
+
+## 6. Set the KMS env var on Cloud Run
+
+Webhook service:
+
+```bash
+gcloud run services update getdevcast-webhook \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
+```
+
+Worker job:
+
+```bash
+gcloud run jobs update devcast-worker \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
+```
+
+Scanner job:
+
+```bash
+gcloud run jobs update devcast-scanner \
+  --region="${REGION}" \
+  --project="${PROJECT_ID}" \
+  --update-env-vars="GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME}"
+```
+
+## 7. Verify launch-critical env vars
+
+Worker:

--- package-lock.json
diff --git a/package-lock.json b/package-lock.json
index 4d648e9..5264309 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -11,6 +11,7 @@
         "@anthropic-ai/sdk": "^0.36.3",
         "@extractus/article-extractor": "^8.0.20",
         "@extractus/feed-extractor": "^7.1.7",
+        "@google-cloud/kms": "^5.4.0",
         "@octokit/rest": "^21.0.2",
         "@supabase/supabase-js": "^2.47.10",
         "better-sqlite3": "^11.7.0",
@@ -562,6 +563,145 @@
         "node": ">= 20"
       }
     },
+    "node_modules/@google-cloud/kms": {
+      "version": "5.4.0",
+      "resolved": "https://registry.npmjs.org/@google-cloud/kms/-/kms-5.4.0.tgz",
+      "integrity": "sha512-+06zUCaJM+wyZISM3F6u/jSqoBs0iZ8Aj9rqOJFePoWkNN7FbR4mQpV7okGHA+Y7caVgq+4QtIDKiFd17SZT+A==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "google-gax": "^5.0.0"
+      },
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@grpc/grpc-js": {
+      "version": "1.14.3",
+      "resolved": "https://registry.npmjs.org/@grpc/grpc-js/-/grpc-js-1.14.3.tgz",
+      "integrity": "sha512-Iq8QQQ/7X3Sac15oB6p0FmUg/klxQvXLeileoqrTRGJYLV+/9tubbr9ipz0GKHjmXVsgFPo/+W+2cA8eNcR+XA==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "@grpc/proto-loader": "^0.8.0",
+        "@js-sdsl/ordered-map": "^4.4.2"
+      },
+      "engines": {
+        "node": ">=12.10.0"
+      }
+    },
+    "node_modules/@grpc/proto-loader": {
+      "version": "0.8.0",
+      "resolved": "https://registry.npmjs.org/@grpc/proto-loader/-/proto-loader-0.8.0.tgz",
+      "integrity": "sha512-rc1hOQtjIWGxcxpb9aHAfLpIctjEnsDehj0DAiVfBlmT84uvR0uUtN2hEi/ecvWVjXUGf5qPF4qEgiLOx1YIMQ==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "lodash.camelcase": "^4.3.0",
+        "long": "^5.0.0",
+        "protobufjs": "^7.5.3",
+        "yargs": "^17.7.2"
+      },
+      "bin": {
+        "proto-loader-gen-types": "build/bin/proto-loader-gen-types.js"
+      },
+      "engines": {
+        "node": ">=6"
+      }
+    },
+    "node_modules/@isaacs/cliui": {
+      "version": "8.0.2",
+      "resolved": "https://registry.npmjs.org/@isaacs/cliui/-/cliui-8.0.2.tgz",
+      "integrity": "sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==",
+      "license": "ISC",
+      "dependencies": {
+        "string-width": "^5.1.2",
+        "string-width-cjs": "npm:string-width@^4.2.0",
+        "strip-ansi": "^7.0.1",
+        "strip-ansi-cjs": "npm:strip-ansi@^6.0.1",
+        "wrap-ansi": "^8.1.0",
+        "wrap-ansi-cjs": "npm:wrap-ansi@^7.0.0"
+      },
+      "engines": {
+        "node": ">=12"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/ansi-regex": {
+      "version": "6.2.2",
+      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.2.2.tgz",
+      "integrity": "sha512-Bq3SmSpyFHaWjPk8If9yc6svM8c56dB5BAtW4Qbw5jHTwwXXcTLoRMkpDJp6VL0XzlWaCHTXrkFURMYmD0sLqg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/chalk/ansi-regex?sponsor=1"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/ansi-styles": {
+      "version": "6.2.3",
+      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-6.2.3.tgz",
+      "integrity": "sha512-4Dj6M28JB+oAH8kFkTLUo+a2jwOFkuqb3yucU0CANcRRUbxS0cP0nZYCGjcc3BNXwRIsUVmDGgzawme7zvJHvg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/emoji-regex": {
+      "version": "9.2.2",
+      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-9.2.2.tgz",
+      "integrity": "sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==",
+      "license": "MIT"
+    },
+    "node_modules/@isaacs/cliui/node_modules/string-width": {
+      "version": "5.1.2",
+      "resolved": "https://registry.npmjs.org/string-width/-/string-width-5.1.2.tgz",
+      "integrity": "sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==",
+      "license": "MIT",
+      "dependencies": {
+        "eastasianwidth": "^0.2.0",
+        "emoji-regex": "^9.2.2",
+        "strip-ansi": "^7.0.1"
+      },
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/sindresorhus"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/strip-ansi": {
+      "version": "7.2.0",
+      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-7.2.0.tgz",
+      "integrity": "sha512-yDPMNjp4WyfYBkHnjIRLfca1i6KMyGCtsVgoKe/z1+6vukgaENdgGBZt+ZmKPc4gavvEZ5OgHfHdrazhgNyG7w==",
+      "license": "MIT",
+      "dependencies": {
+        "ansi-regex": "^6.2.2"
+      },
+      "engines": {
+        "node": ">=12"
+      },
+      "funding": {
+        "url": "https://github.com/chalk/strip-ansi?sponsor=1"
+      }
+    },
+    "node_modules/@isaacs/cliui/node_modules/wrap-ansi": {
+      "version": "8.1.0",
+      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-8.1.0.tgz",
+      "integrity": "sha512-si7QWI6zUMq56bESFvagtmzMdGOtoxfR+Sez11Mobfc7tm+VkUckk9bW2UeffTGVUbOksxmSw0AA2gs8g71NCQ==",
+      "license": "MIT",
+      "dependencies": {
+        "ansi-styles": "^6.1.0",
+        "string-width": "^5.0.1",
+        "strip-ansi": "^7.0.1"
+      },
+      "engines": {
+        "node": ">=12"

--- package.json
diff --git a/package.json b/package.json
index 6c0f04f..eb0cd31 100644
--- a/package.json
+++ b/package.json
@@ -17,6 +17,7 @@
     "seed-corpus:extract": "tsx --env-file=.env.local scripts/seed-corpus/extract-text.ts",
     "seed-corpus:validate": "tsx --env-file=.env.local scripts/seed-corpus/validate.ts",
     "seed-corpus:seed": "tsx --env-file=.env.local scripts/seed-corpus/seed.ts",
+    "rotate-tenant-tokens": "tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts",
     "test": "vitest run",
     "typecheck": "tsc --noEmit"
   },
@@ -24,6 +25,7 @@
     "@anthropic-ai/sdk": "^0.36.3",
     "@extractus/article-extractor": "^8.0.20",
     "@extractus/feed-extractor": "^7.1.7",
+    "@google-cloud/kms": "^5.4.0",
     "@octokit/rest": "^21.0.2",
     "@supabase/supabase-js": "^2.47.10",
     "better-sqlite3": "^11.7.0",


--- scripts/rotate-tenant-tokens.ts
diff --git a/scripts/rotate-tenant-tokens.ts b/scripts/rotate-tenant-tokens.ts
new file mode 100644
index 0000000..e0334fa
--- /dev/null
+++ b/scripts/rotate-tenant-tokens.ts
@@ -0,0 +1,120 @@
+/**
+ * Re-encrypt legacy tenant tokens in Supabase using envelope encryption with GCP KMS.
+ *
+ * Usage:
+ *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts
+ *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts --dry-run
+ *   tsx --env-file=.env.local scripts/rotate-tenant-tokens.ts --tenant-id <uuid>
+ */
+
+import { createClient } from '@supabase/supabase-js';
+import {
+  isEncryptedToken,
+  sealTenantSecrets,
+} from '../src/security/tenant-secrets.js';
+
+interface TenantRow {
+  readonly id: string;
+  readonly github_username: string;
+  readonly buffer_access_token: string | null;
+  readonly linkedin_access_token: string | null;
+  readonly encrypted_dek: string | null;
+}
+
+function getArgValue(flag: string): string | null {
+  const index = process.argv.indexOf(flag);
+  if (index === -1) return null;
+  return process.argv[index + 1] ?? null;
+}
+
+function shouldRotateToken(token: string | null, encryptedDek: string | null): boolean {
+  if (!token) return false;
+  if (!encryptedDek) return true;
+  return !isEncryptedToken(token);
+}
+
+async function main(): Promise<void> {
+  const supabaseUrl = process.env['SUPABASE_URL'];
+  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
+
+  if (!supabaseUrl || !supabaseKey) {
+    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
+  }
+
+  const dryRun = process.argv.includes('--dry-run');
+  const tenantId = getArgValue('--tenant-id');
+  const db = createClient(supabaseUrl, supabaseKey);
+
+  let query = db
+    .from('tenants')
+    .select('id, github_username, buffer_access_token, linkedin_access_token, encrypted_dek')
+    .or('buffer_access_token.not.is.null,linkedin_access_token.not.is.null')
+    .order('created_at', { ascending: true });
+
+  if (tenantId) {
+    query = query.eq('id', tenantId);
+  }
+
+  const { data, error } = await query;
+  if (error) {
+    throw new Error(`Failed to fetch tenants: ${error.message}`);
+  }
+
+  const rows = (data ?? []) as TenantRow[];
+  let rotated = 0;
+  let skipped = 0;
+
+  for (const row of rows) {
+    const rotateBuffer = shouldRotateToken(row.buffer_access_token, row.encrypted_dek);
+    const rotateLinkedIn = shouldRotateToken(row.linkedin_access_token, row.encrypted_dek);
+
+    if (!rotateBuffer && !rotateLinkedIn) {
+      skipped++;
+      console.log(`SKIP ${row.github_username} (${row.id})`);
+      continue;
+    }
+
+    const sealed = await sealTenantSecrets({
+      ...(rotateBuffer ? { bufferAccessToken: row.buffer_access_token } : {}),
+      ...(rotateLinkedIn ? { linkedinAccessToken: row.linkedin_access_token } : {}),
+    }, row.encrypted_dek);
+
+    const updates: Record<string, string> = {
+      encrypted_dek: sealed.encryptedDek,
+    };
+
+    if (rotateBuffer && sealed.bufferAccessToken) {
+      updates['buffer_access_token'] = sealed.bufferAccessToken;
+    }
+    if (rotateLinkedIn && sealed.linkedinAccessToken) {
+      updates['linkedin_access_token'] = sealed.linkedinAccessToken;
+    }
+
+    if (dryRun) {
+      console.log(`DRY RUN ${row.github_username} (${row.id})`);
+      continue;
+    }
+
+    const { error: updateError } = await db
+      .from('tenants')
+      .update(updates)
+      .eq('id', row.id);
+
+    if (updateError) {
+      throw new Error(`Failed to rotate tenant ${row.id}: ${updateError.message}`);
+    }
+
+    rotated++;
+    console.log(`ROTATED ${row.github_username} (${row.id})`);
+  }
+
+  console.log('');
+  console.log(`Rotated: ${rotated}`);
+  console.log(`Skipped: ${skipped}`);
+  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
+}
+
+main().catch((err) => {
+  console.error(err);
+  process.exit(1);
+});


--- src/security/tenant-secrets.ts
diff --git a/src/security/tenant-secrets.ts b/src/security/tenant-secrets.ts
new file mode 100644
index 0000000..f5e8564
--- /dev/null
+++ b/src/security/tenant-secrets.ts
@@ -0,0 +1,181 @@
+import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
+import { KeyManagementServiceClient } from '@google-cloud/kms';
+
+const DEK_BYTES = 32;
+const GCM_IV_BYTES = 12;
+const ENCRYPTED_TOKEN_PREFIX = 'enc-v1';
+
+interface TenantSecretsInput {
+  readonly bufferAccessToken?: string | null;
+  readonly linkedinAccessToken?: string | null;
+}
+
+interface LoadedDek {
+  readonly encryptedDek: string;
+  readonly plaintextDek: Buffer;
+}
+
+export interface TenantSecretsRow {
+  readonly encrypted_dek: string | null;
+  readonly buffer_access_token: string | null;
+  readonly linkedin_access_token?: string | null;
+}
+
+export interface ResolvedTenantSecrets {
+  readonly bufferAccessToken: string | null;
+  readonly linkedinAccessToken: string | null;
+}
+
+export interface SealedTenantSecrets {
+  readonly encryptedDek: string;
+  bufferAccessToken?: string | null;
+  linkedinAccessToken?: string | null;
+}
+
+let kmsClient: KeyManagementServiceClient | null = null;
+
+function getKmsClient(): KeyManagementServiceClient {
+  if (!kmsClient) kmsClient = new KeyManagementServiceClient();
+  return kmsClient;
+}
+
+function getKmsKeyName(): string {
+  const keyName = process.env['GCP_KMS_KEY_NAME'] ?? process.env['KMS_KEY_NAME'] ?? '';
+  if (!keyName) {
+    throw new Error('GCP_KMS_KEY_NAME is required to encrypt tenant tokens');
+  }
+  return keyName;
+}
+
+function encode(value: Uint8Array): string {
+  return Buffer.from(value).toString('base64url');
+}
+
+function decode(value: string): Buffer {
+  return Buffer.from(value, 'base64url');
+}
+
+export function isEncryptedToken(token: string): boolean {
+  return token.startsWith(`${ENCRYPTED_TOKEN_PREFIX}:`);
+}
+
+function encryptWithDek(plaintextDek: Buffer, token: string): string {
+  const iv = randomBytes(GCM_IV_BYTES);
+  const cipher = createCipheriv('aes-256-gcm', plaintextDek, iv);
+  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
+  const authTag = cipher.getAuthTag();
+  return [
+    ENCRYPTED_TOKEN_PREFIX,
+    encode(iv),
+    encode(authTag),
+    encode(ciphertext),
+  ].join(':');
+}
+
+function decryptWithDek(plaintextDek: Buffer, token: string): string {
+  const [prefix, ivRaw, authTagRaw, ciphertextRaw] = token.split(':');
+  if (
+    prefix !== ENCRYPTED_TOKEN_PREFIX ||
+    !ivRaw ||
+    !authTagRaw ||
+    !ciphertextRaw
+  ) {
+    throw new Error('Invalid encrypted token format');
+  }
+
+  const decipher = createDecipheriv('aes-256-gcm', plaintextDek, decode(ivRaw));
+  decipher.setAuthTag(decode(authTagRaw));
+  const plaintext = Buffer.concat([
+    decipher.update(decode(ciphertextRaw)),
+    decipher.final(),
+  ]);
+  return plaintext.toString('utf8');
+}
+
+async function wrapDek(plaintextDek: Buffer): Promise<string> {
+  const [response] = await getKmsClient().encrypt({
+    name: getKmsKeyName(),
+    plaintext: plaintextDek,
+  });
+
+  if (!response.ciphertext) {
+    throw new Error('KMS encrypt returned no ciphertext for tenant DEK');
+  }
+
+  return typeof response.ciphertext === 'string'
+    ? encode(Buffer.from(response.ciphertext, 'base64'))
+    : encode(response.ciphertext);
+}
+
+async function unwrapDek(encryptedDek: string): Promise<Buffer> {
+  const [response] = await getKmsClient().decrypt({
+    name: getKmsKeyName(),
+    ciphertext: decode(encryptedDek),
+  });
+
+  if (!response.plaintext) {
+    throw new Error('KMS decrypt returned no plaintext for tenant DEK');
+  }
+
+  return Buffer.from(response.plaintext);
+}
+
+async function loadDek(existingEncryptedDek: string | null): Promise<LoadedDek> {
+  if (existingEncryptedDek) {
+    return {
+      encryptedDek: existingEncryptedDek,
+      plaintextDek: await unwrapDek(existingEncryptedDek),
+    };
+  }
+
+  const plaintextDek = randomBytes(DEK_BYTES);
+  return {
+    encryptedDek: await wrapDek(plaintextDek),
+    plaintextDek,
+  };
+}
+
+export async function sealTenantSecrets(
+  secrets: TenantSecretsInput,
+  existingEncryptedDek: string | null,
+): Promise<SealedTenantSecrets> {
+  const dek = await loadDek(existingEncryptedDek);
+  const sealed: SealedTenantSecrets = { encryptedDek: dek.encryptedDek };
+

--- src/webhook/handlers/linkedin-oauth.ts
diff --git a/src/webhook/handlers/linkedin-oauth.ts b/src/webhook/handlers/linkedin-oauth.ts
index 1046a28..f5267e3 100644
--- a/src/webhook/handlers/linkedin-oauth.ts
+++ b/src/webhook/handlers/linkedin-oauth.ts
@@ -2,6 +2,7 @@ import { createHmac, timingSafeEqual } from 'crypto';
 import { logger } from '../../utils/logger.js';
 import { LinkedInClient } from '../../linkedin/client.js';
 import type { SupabaseClient } from '@supabase/supabase-js';
+import { sealTenantSecrets } from '../../security/tenant-secrets.js';
 
 const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
 const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
@@ -114,13 +115,36 @@ export async function handleLinkedInCallback(
     return { status: 302, location: `/onboard?installation_id=${installationId}&error=linkedin_profile_failed` };
   }
 
+  const { data: tenant, error: tenantError } = await db
+    .from('tenants')
+    .select('encrypted_dek')
+    .eq('github_installation_id', installationId)
+    .single();
+
+  if (tenantError || !tenant) {
+    logger.error('linkedin.callback.tenant_fetch_failed', { installationId, error: tenantError?.message ?? 'no data' });
+    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
+  }
+
+  let sealed;
+  try {
+    sealed = await sealTenantSecrets(
+      { linkedinAccessToken: tokenData.access_token },
+      (tenant as { encrypted_dek: string | null }).encrypted_dek,
+    );
+  } catch (err) {
+    logger.error('linkedin.callback.token_encrypt_failed', { installationId, error: String(err) });
+    return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
+  }
+
   // Store in tenant
   const { error } = await db
     .from('tenants')
     .update({
-      linkedin_access_token: tokenData.access_token,
+      linkedin_access_token: sealed.linkedinAccessToken ?? null,
       linkedin_member_id: memberUrn,
       linkedin_token_expires_at: expiresAt,
+      encrypted_dek: sealed.encryptedDek,
     })
     .eq('github_installation_id', installationId);
 


--- src/webhook/handlers/onboard.ts
diff --git a/src/webhook/handlers/onboard.ts b/src/webhook/handlers/onboard.ts
index 919d5fc..565f8b5 100644
--- a/src/webhook/handlers/onboard.ts
+++ b/src/webhook/handlers/onboard.ts
@@ -1,10 +1,12 @@
 import { logger } from '../../utils/logger.js';
 import type { SupabaseClient } from '@supabase/supabase-js';
+import { sealTenantSecrets } from '../../security/tenant-secrets.js';
 
 interface TenantRow {
   readonly id: string;
   readonly github_username: string;
   readonly buffer_access_token: string | null;
+  readonly encrypted_dek: string | null;
   readonly linkedin_member_id: string | null;
   readonly config: Record<string, unknown>;
   readonly voice_bootstrap: string | null;
@@ -12,7 +14,7 @@ interface TenantRow {
 
 function maskToken(token: string | null): string {
   if (!token) return '';
-  return token.slice(0, 6) + '••••••••';
+  return 'configured••••••••';
 }
 
 function html(tenant: TenantRow, installationId: number, linkedinClientId: string, appBaseUrl: string, saved: boolean): string {
@@ -138,7 +140,7 @@ export async function handleOnboardGet(
 ): Promise<{ status: number; body: string; contentType: string }> {
   const { data, error } = await db
     .from('tenants')
-    .select('id, github_username, buffer_access_token, linkedin_member_id, config, voice_bootstrap')
+    .select('id, github_username, buffer_access_token, encrypted_dek, linkedin_member_id, config, voice_bootstrap')
     .eq('github_installation_id', installationId)
     .single();
 
@@ -180,7 +182,7 @@ export async function handleOnboardPost(
   // Fetch current tenant to merge config
   const { data: tenant, error: fetchError } = await db
     .from('tenants')
-    .select('id, config')
+    .select('id, config, encrypted_dek')
     .eq('github_installation_id', installationId)
     .single();
 
@@ -207,7 +209,17 @@ export async function handleOnboardPost(
 
   // Only update buffer_access_token if a new one was provided (not the masked placeholder)
   if (bufferToken && !bufferToken.includes('••')) {
-    updates['buffer_access_token'] = bufferToken;
+    try {
+      const sealed = await sealTenantSecrets(
+        { bufferAccessToken: bufferToken },
+        (tenant as { encrypted_dek: string | null }).encrypted_dek,
+      );
+      updates['buffer_access_token'] = sealed.bufferAccessToken ?? null;
+      updates['encrypted_dek'] = sealed.encryptedDek;
+    } catch (err) {
+      logger.error('onboard.buffer_token_encrypt_failed', { installationId, error: String(err) });
+      return { status: 302, location: `/onboard?installation_id=${installationId}&error=save_failed` };
+    }
   }
 
   // Save voice bootstrap if provided


--- src/worker/main-scan-tenants.ts
diff --git a/src/worker/main-scan-tenants.ts b/src/worker/main-scan-tenants.ts
index eb1f241..fce3990 100644
--- a/src/worker/main-scan-tenants.ts
+++ b/src/worker/main-scan-tenants.ts
@@ -14,6 +14,7 @@ import { scanSentPosts } from '../buffer/sent-scanner.js';
 import { SupabaseStorage } from '../voice/supabase-storage.js';
 import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
+import { resolveTenantSecrets } from '../security/tenant-secrets.js';
 
 const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
 const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
@@ -28,7 +29,8 @@ const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 interface TenantRow {
   readonly id: string;
   readonly github_username: string;
-  readonly buffer_access_token: string;
+  readonly buffer_access_token: string | null;
+  readonly encrypted_dek: string | null;
   readonly config: Record<string, unknown>;
 }
 
@@ -60,7 +62,7 @@ async function main(): Promise<void> {
 
   const { data: tenants, error } = await db
     .from('tenants')
-    .select('id, github_username, buffer_access_token, config')
+    .select('id, github_username, buffer_access_token, encrypted_dek, config')
     .eq('active', true)
     .not('buffer_access_token', 'is', null);
 
@@ -78,8 +80,13 @@ async function main(): Promise<void> {
   for (const tenant of rows) {
     try {
       const config = buildConfig(tenant);
+      const secrets = await resolveTenantSecrets(tenant);
       const storage = new SupabaseStorage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, tenant.id);
-      const bufferClient = new BufferClient(tenant.buffer_access_token);
+      if (!secrets.bufferAccessToken) {
+        logger.warn('scanner.tenant.skip_missing_buffer_token', { tenantId: tenant.id, username: tenant.github_username });
+        continue;
+      }
+      const bufferClient = new BufferClient(secrets.bufferAccessToken);
 
       await scanSentPosts(bufferClient, storage, config);
       scanned++;


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 00e308c..22ae3f8 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -17,6 +17,7 @@ import { logger } from '../utils/logger.js';
 import { ConfigSchema } from '../config/schema.js';
 import type { Config } from '../config/schema.js';
 import type { SaveDraftInput } from '../voice/storage.js';
+import { resolveTenantSecrets } from '../security/tenant-secrets.js';
 
 interface TenantRow {
   readonly id: string;
@@ -24,6 +25,7 @@ interface TenantRow {
   readonly github_username: string;
   readonly buffer_access_token: string | null;
   readonly linkedin_access_token: string | null;
+  readonly encrypted_dek: string | null;
   readonly linkedin_member_id: string | null;
   readonly config: Record<string, unknown>;
 }
@@ -100,7 +102,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
 
   const { data: tenantData, error: tenantError } = await deps.db
     .from('tenants')
-    .select('id, github_installation_id, github_username, buffer_access_token, linkedin_access_token, linkedin_member_id, config')
+    .select('id, github_installation_id, github_username, buffer_access_token, linkedin_access_token, encrypted_dek, linkedin_member_id, config')
     .eq('id', job.tenant_id)
     .eq('active', true)
     .single();
@@ -110,6 +112,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
   }
   const tenant = tenantData as TenantRow;
   const config = buildConfig(tenant);
+  const secrets = await resolveTenantSecrets(tenant);
 
   logger.info('worker.job.tenant', {
     jobId,
@@ -244,9 +247,9 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       );
 
       // Post directly to LinkedIn if connected
-      if (tenant.linkedin_access_token && tenant.linkedin_member_id) {
+      if (secrets.linkedinAccessToken && tenant.linkedin_member_id) {
         try {
-          const linkedinClient = new LinkedInClient(tenant.linkedin_access_token);
+          const linkedinClient = new LinkedInClient(secrets.linkedinAccessToken);
           await linkedinClient.post(tenant.linkedin_member_id, linkedinPost);
           await storage.updatePublished({
             id: draftId,
@@ -268,8 +271,8 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
       }
 
       // Create Buffer Idea if configured (for Instagram or as backup)
-      if (tenant.buffer_access_token) {
-        const bufferClient = new BufferClient(tenant.buffer_access_token);
+      if (secrets.bufferAccessToken) {
+        const bufferClient = new BufferClient(secrets.bufferAccessToken);
         const publishResult = await publishToBuffer(
           bufferClient, storage, config, draftId, bufferText, commit.message,
         );

```

### Commit 3: 320ce9f
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

### Commit 4: 77bec83
**Message:** feat: expand seed corpus to 200 articles

**Diff:**
```diff
--- seed-articles-frozen.csv
diff --git a/seed-articles-frozen.csv b/seed-articles-frozen.csv
index 433bdf3..d998b68 100644
--- a/seed-articles-frozen.csv
+++ b/seed-articles-frozen.csv
@@ -135,3 +135,67 @@ id,track,module_primary,module_secondary,url,title,source_name,author,published_
 134,track2,dependency_health,"security,python_patterns",https://blog.python.org/2026/03/python-31213-31115-31020/,"Python 3.12.13, 3.11.15 and 3.10.20 are now available!","Python Insider","Thomas Wouters",2026-03-03,8,"A practical security-release post with concrete remediation details across supported Python lines, useful for dependency hygiene and upgrade decision-making.",kept,,
 135,track2,java_patterns,"dependency_health,devops",https://quarkus.io/blog/quarkus-3-33-released/,"Quarkus 3.33 LTS - new LTS version","Quarkus Blog","Guillaume Smet",2026-03-25,8,"A solid platform article on the new Quarkus LTS, migration guides, and component upgrades that matter for long-lived Java services and upgrade planning.",kept,,
 136,track2,react_patterns,"evolutionary,design_patterns",https://react.dev/blog/2026/02/24/the-react-foundation,"The React Foundation: A New Home for React Hosted by the Linux Foundation","React Blog","Matt Carroll",2026-02-24,8,"A useful ecosystem-governance article because it explains how React is evolving its stewardship and technical governance without tying the project to a single company.",kept,,
+137,track2,go_patterns,"type_system,complexity",https://go.dev/blog/type-construction-and-cycle-detection,Type Construction and Cycle Detection,The Go Blog,Go Team,2026-03-24,9,"A strong Go internals article on type construction and cycle detection, with concrete compiler and type-system lessons that map well to language implementation work.",kept,,
+138,track2,clean_code,"performance,go_patterns",https://go.dev/blog/inliner,//go:fix inline and the source-level inliner,The Go Blog,Go Team,2026-03-10,8,"A useful Go engineering post on automated source modernization and inlining, connecting code evolution with runtime performance in a very concrete way.",kept,,
+139,track2,performance,"go_patterns,complexity",https://go.dev/blog/allocation-optimizations,Allocating on the Stack,The Go Blog,Go Team,2026-02-27,9,"A high-signal runtime article on stack allocation decisions and memory behavior, which makes it especially useful for performance-sensitive Go systems.",kept,,
+140,track2,clean_code,"evolutionary,go_patterns",https://go.dev/blog/gofix,Using go fix to modernize Go code,The Go Blog,Go Team,2026-02-17,8,"A strong maintenance article on using go fix to evolve a large Go codebase safely, tying API shifts to practical upgrade workflows.",kept,,
+141,track2,go_patterns,"dependency_health,evolutionary",https://go.dev/blog/go1.26,Go 1.26 is released,The Go Blog,Go Team,2026-02-10,8,A solid release article because it captures new Go runtime and language changes in a form that is directly useful for upgrade planning and ecosystem compatibility.,kept,,
+142,track2,dx,"evolutionary,go_patterns",https://go.dev/blog/survey2025,Results from the 2025 Go Developer Survey,The Go Blog,Go Team,2026-01-21,7,"A useful ecosystem article because it shows where the Go team is hearing friction around tooling, language evolution, and developer experience at scale.",kept,,
+143,track2,performance,"concurrency,go_patterns",https://go.dev/blog/greenteagc,The Green Tea Garbage Collector,The Go Blog,Go Team,2025-10-29,9,"A strong Go runtime article on garbage collection tradeoffs and latency behavior, with clear implications for performance and concurrent workloads.",kept,,
+144,track2,observability,"error_resilience,go_patterns",https://go.dev/blog/flight-recorder,Flight Recorder in Go 1.25,The Go Blog,Go Team,2025-09-26,8,"A practical observability post on low-overhead runtime diagnostics in Go, useful for debugging production failures without destabilizing the system.",kept,,
+145,track2,react_patterns,"evolutionary,dx",https://react.dev/blog/2023/05/03/react-canaries,React Canaries: Enabling Incremental Feature Rollout Outside Meta,React Blog,React Team,2023-05-03,8,"A strong React process article on shipping framework changes incrementally, with concrete lessons about release channels and ecosystem evolution.",kept,,
+146,track2,react_patterns,"evolutionary,architecture_patterns",https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023,React Labs: What We've Been Working On – March 2023,React Blog,React Team,2023-03-22,8,"A useful roadmap article because it ties major React architecture bets to practical concerns around data fetching, rendering, and framework integration.",kept,,
+147,track2,dx,"react_patterns,design_patterns",https://react.dev/blog/2023/03/16/introducing-react-dev,Introducing react.dev,React Blog,React Team,2023-03-16,7,"A useful developer-experience post about documentation and learning design, with practical lessons for making complex frontend systems teachable.",kept,,
+148,track2,react_patterns,"evolutionary,architecture_patterns",https://react.dev/blog/2022/06/15/react-labs-what-we-have-been-working-on-june-2022,React Labs: What We've Been Working On – June 2022,React Blog,React Team,2022-06-15,8,"A strong React architecture article that exposes the thinking behind concurrent rendering, server components, and the longer-term framework direction.",kept,,
+149,track2,react_patterns,"concurrency,performance",https://react.dev/blog/2022/03/29/react-v18,React v18.0,React Blog,React Team,2022-03-29,9,A foundational React release post because it explains concurrent rendering primitives and the performance model that modern React frameworks build on.,kept,,
+150,track2,react_patterns,"dx,evolutionary",https://react.dev/blog/2022/03/08/react-18-upgrade-guide,How to Upgrade to React 18,React Blog,React Team,2022-03-08,8,"A practical migration guide that turns a major framework release into an actionable upgrade path, which makes it useful for developer experience and change management.",kept,,
+151,track2,react_patterns,"evolutionary,concurrency",https://react.dev/blog/2021/06/08/the-plan-for-react-18,The Plan for React 18,React Blog,React Team,2021-06-08,8,"A high-signal planning post that lays out the React 18 direction early, making the tradeoffs around concurrency and rollout strategy very visible.",kept,,
+152,track2,react_patterns,"dx,evolutionary",https://react.dev/blog/2025/10/16/react-conf-2025-recap,React Conf 2025 Recap,React Blog,React Team,2025-10-16,7,A useful ecosystem recap because it turns the major technical announcements around React into one digestible checkpoint for framework direction.,kept,,replacement for failed RSC post
+153,track2,python_patterns,"performance,evolutionary",https://blog.python.org/2026/03/python-3150-alpha-7/,Python 3.15.0 alpha 7,Python Insider,Hugo van Kemenade,2026-03-10,8,A strong Python preview release post because it surfaces runtime changes and upgrade signals while the release is still taking shape.,kept,,
+154,track2,security,"dependency_health,python_patterns",https://blog.python.org/2026/02/join-the-python-security-response-team/,Join the Python Security Response Team!,Python Insider,Seth Larson,2026-02-17,8,A useful security-governance article because it clarifies how the Python ecosystem handles vulnerability response and long-term maintenance responsibilities.,kept,,
+155,track2,python_patterns,"type_system,evolutionary",https://blog.python.org/2026/02/python-3150-alpha-6/,Python 3.15.0 alpha 6,Python Insider,Hugo van Kemenade,2026-02-11,8,A useful Python alpha release post because it packages language evolution and tooling changes into a concrete preview for maintainers.,kept,,
+156,track2,dependency_health,"security,python_patterns",https://blog.python.org/2026/02/python-3143-and-31312-are-now-available/,Python 3.14.3 and 3.13.12 are now available!,Python Insider,Thomas Wouters,2026-02-03,8,A practical maintenance release post with clear upgrade signals for teams carrying production Python dependencies across active branches.,kept,,
+157,track2,python_patterns,"performance,evolutionary",https://blog.python.org/2026/01/python-3150-alpha-5-yes-another-alpha/,"Python 3.15.0 alpha 5 (yes, another alpha!)",Python Insider,Hugo van Kemenade,2026-01-14,8,A useful preview release because it captures the churn and corrective work that often shape a language runtime before stabilization.,kept,,
+158,track2,python_patterns,"type_system,evolutionary",https://blog.python.org/2026/01/python-3150-alpha-4/,Python 3.15.0 alpha 4,Python Insider,Hugo van Kemenade,2026-01-13,8,A solid Python preview release post that helps track language and runtime changes while they are still inexpensive to react to.,kept,,
+159,track2,python_patterns,"performance,evolutionary",https://blog.python.org/2025/12/python-3150-alpha-3/,Python 3.15.0 alpha 3,Python Insider,Hugo van Kemenade,2025-12-16,8,A strong early-release article because it exposes the direction of the runtime and compatibility story before a stable release locks things in.,kept,,
+160,track2,python_patterns,"type_system,dependency_health",https://blog.python.org/2025/07/python-314-release-candidate-1-is-go/,Python 3.14 release candidate 1 is go!,Python Insider,Hugo van Kemenade,2025-07-22,8,A strong release-candidate post because it captures the near-final Python 3.14 shape with direct upgrade value for maintainers.,kept,,replacement candidate
+161,track2,python_patterns,"performance,evolutionary",https://blog.python.org/2025/07/python-3140-beta-4-is-here/,Python 3.14.0 beta 4 is here!,Python Insider,Hugo van Kemenade,2025-07-08,8,A useful beta release post because it makes the pre-release stabilization work visible while teams can still react cheaply.,kept,,replacement candidate
+162,track2,python_patterns,"dependency_health,type_system",https://blog.python.org/2025/12/python-3141-is-now-available/,Python 3.14.1 is now available!,Python Insider,Hugo van Kemenade,2025-12-02,8,A useful release post because it packages the newest stable Python line together with the maintenance signals teams need for adoption decisions.,kept,,
+163,track2,python_patterns,"concurrency,evolutionary",https://blog.python.org/2025/11/python-3150a2/,Python 3.15.0 alpha 2,Python Insider,Hugo van Kemenade,2025-11-19,8,"A strong preview release because it shows the Python runtime evolving in public, with enough detail to inform concurrency and ecosystem planning.",kept,,
+164,track2,python_patterns,"concurrency,evolutionary",https://blog.python.org/2025/10/python-3150-alpha-1/,Python 3.15.0 alpha 1 is now available,Python Insider,Hugo van Kemenade,2025-10-15,8,An early Python alpha post that is useful for spotting runtime direction and adoption risk before downstream tooling catches up.,kept,,
+165,track2,dependency_health,"error_resilience,python_patterns",https://blog.python.org/2025/06/python-3140-beta-3-is-here/,Python 3.14.0 beta 3 is here!,Python Insider,Hugo van Kemenade,2025-06-17,8,A practical pre-release post that helps teams track stabilization work and readiness signals ahead of a major Python release.,kept,,replacement candidate
+166,track2,dependency_health,"security,python_patterns",https://blog.python.org/2025/10/python-31212-31114-31019-and-3924-are/,"Python 3.12.12, 3.11.14, 3.10.19 and 3.9.24 are now available!",Python Insider,Thomas Wouters,2025-10-09,8,A strong multi-branch release post because it packages security and maintenance signals across the supported Python ecosystem in one place.,kept,,
+167,track2,dependency_health,"security,python_patterns",https://blog.python.org/2025/06/python-3134-31211-31113-31018-and-3923/,"Python 3.13.4, 3.12.11, 3.11.13, 3.10.18 and 3.9.23 are now available",Python Insider,Thomas Wouters,2025-06-03,8,A strong multi-branch release note because it bundles maintenance and security posture across supported Python lines.,kept,,replacement candidate
+168,track2,python_patterns,"type_system,performance",https://blog.python.org/2025/09/python-3140rc3-is-go/,Python 3.14.0rc3 is go!,Python Insider,Hugo van Kemenade,2025-09-18,8,A valuable release-candidate post because it captures the final shape of a Python release just before adoption decisions become urgent.,kept,,
+169,track2,python_patterns,"type_system,dependency_health",https://blog.python.org/2025/08/python-3140rc2-and-3137-are-go/,Python 3.14.0rc2 and 3.13.7 are go!,Python Insider,Hugo van Kemenade,2025-08-14,8,A strong dual-release post because it links near-final feature work with practical branch maintenance for production Python teams.,kept,,
+170,track2,java_patterns,"dependency_health,error_resilience",https://quarkus.io/blog/quarkus-3-34-3-released/,Quarkus 3.34.3 - Maintenance release,Quarkus Blog,Quarkus Team,2026-04-08,8,A useful Quarkus maintenance release post because it makes branch health and upgrade timing visible for Java platform teams.,kept,,
+171,track2,java_patterns,"dependency_health,error_resilience",https://quarkus.io/blog/quarkus-3-34-2-released/,Quarkus 3.34.2 - Maintenance release,Quarkus Blog,Quarkus Team,2026-04-02,8,A practical Quarkus maintenance post that helps track safe upgrade windows and ongoing branch stabilization.,kept,,
+172,track2,java_patterns,"performance,dependency_health",https://quarkus.io/blog/quarkus-3-34-released/,Quarkus 3.34 - Enhancements all around,Quarkus Blog,Quarkus Team,2026-03-25,8,A strong Java platform release article because it bundles new capabilities and upgrade guidance that matter to service maintainers.,kept,,
+173,track2,dependency_health,"java_patterns,devops",https://quarkus.io/blog/quarkus-3-27-3-released/,Quarkus 3.27.3 released - LTS maintenance release,Quarkus Blog,Quarkus Team,2026-03-25,8,A useful LTS maintenance post because it clarifies support cadence and upgrade signals for long-lived Java services.,kept,,
+174,track2,dependency_health,"java_patterns,devops",https://quarkus.io/blog/quarkus-3-20-6-released/,Quarkus 3.20.6 released - LTS maintenance release,Quarkus Blog,Quarkus Team,2026-03-25,8,A practical LTS release post that helps teams reason about supported baselines and maintenance strategy for Java runtimes.,kept,,
+175,track2,architecture_patterns,"integration,java_patterns",https://quarkus.io/blog/quarkus-polaris/,Apache Polaris is powered by Quarkus,Quarkus Blog,Quarkus Team,2026-03-24,8,"A strong architecture article showing how Quarkus is used inside a larger platform, with concrete integration lessons for service design.",kept,,
+176,track2,java_patterns,"dependency_health,error_resilience",https://quarkus.io/blog/quarkus-3-32-3-released/,Quarkus 3.32.3 - Maintenance release,Quarkus Blog,Quarkus Team,2026-03-11,8,A useful maintenance release note for tracking branch safety and staying current without overhauling the whole stack.,kept,,
+177,track2,java_patterns,"dependency_health,error_resilience",https://quarkus.io/blog/quarkus-3-32-2-released/,Quarkus 3.32.2 - Maintenance release,Quarkus Blog,Quarkus Team,2026-03-05,8,A practical maintenance post for Java teams that need signals on bugfix rollups and supported upgrade paths.,kept,,
+178,track2,api_design,"ai_assisted,java_patterns",https://quarkus.io/blog/a2a-java-sdk-1-0-0-alpha2-released/,A2A Java SDK 1.0.0.Alpha2 Released,Quarkus Blog,Quarkus Team,2026-02-12,8,A useful SDK article because it exposes API design decisions for agent-style Java integrations while the ecosystem is still early.,kept,,
+179,track2,testing,"java_patterns,dx",https://quarkus.io/blog/quarkus-test-coverage-extensions/,Closing the Gap: Test Coverage for Quarkus Extensions,Quarkus Blog,Quarkus Team,2026-02-10,8,"A strong testing article on extension coverage and verification strategy, useful for anyone maintaining a plugin-style Java platform.",kept,,
+180,track2,java_patterns,"dependency_health,performance",https://quarkus.io/blog/quarkus-3-31-released/,"Quarkus 3.31 - Full Java 25 support, Quarkus Maven packaging, Panache Next, and more!",Quarkus Blog,Quarkus Team,2026-01-28,8,A strong Java platform release because it ties language-version support to concrete packaging and runtime improvements.,kept,,
+181,track2,devops,"dependency_health,error_resilience",https://quarkus.io/blog/retiring-ubi8-images/,Retiring community UBI 8 images for Quarkus,Quarkus Blog,Quarkus Team,2026-01-21,8,"A practical platform-maintenance article on base-image retirement, useful for understanding operational risk and dependency churn in Java services.",kept,,
+182,track2,performance,"devops,complexity",https://blog.cloudflare.com/from-bpf-to-packet/,From bytecode to bytes: automated magic packet generation,Cloudflare Blog,Cloudflare Team,2026-04-08,9,"A high-signal systems article on code generation and low-level packet work, with clear performance and operations implications.",kept,,
+183,track2,security,"evolutionary,dependency_health",https://blog.cloudflare.com/post-quantum-roadmap/,Cloudflare targets 2029 for full post-quantum security,Cloudflare Blog,Cloudflare Team,2026-04-07,8,A strong security strategy article that turns post-quantum migration into a concrete systems roadmap instead of abstract future talk.,kept,,
+184,track2,architecture_patterns,"dx,devops",https://blog.cloudflare.com/organizations-beta/,How we built Organizations to help enterprises manage Cloudflare at scale,Cloudflare Blog,Cloudflare Team,2026-04-06,8,A useful platform-design article because it explains how operational structure and product architecture meet in enterprise-scale control planes.,kept,,
+185,track2,performance,"ai_assisted,architecture_patterns",https://blog.cloudflare.com/rethinking-cache-ai-humans/,Why we're rethinking cache for the AI era,Cloudflare Blog,Cloudflare Team,2026-04-02,8,"A strong systems article on cache design under changing workloads, especially useful where AI traffic shifts long-standing performance assumptions.",kept,,
+186,track2,security,"devops,error_resilience",https://blog.cloudflare.com/programmable-flow-protection/,Introducing Programmable Flow Protection: custom DDoS mitigation logic for Magic Transit customers,Cloudflare Blog,Cloudflare Team,2026-03-31,8,A practical security-and-operations article that shows how programmable defenses can reduce incident blast radius in production networks.,kept,,
+187,track2,devops,"error_resilience,performance",https://blog.cloudflare.com/one-line-kubernetes-fix-saved-600-hours-a-year/,A one-line Kubernetes fix that saved 600 hours a year,Cloudflare Blog,Cloudflare Team,2026-03-26,8,A strong operations article because it shows how a tiny infrastructure change can unlock reliability and efficiency gains at large scale.,kept,,
+188,track2,type_system,"elixir_patterns,complexity",https://dashbit.co/blog/type-systems-are-leaky-abstractions-map-take,Type systems are leaky abstractions: the case of Map.take!/2,Dashbit Blog,José Valim,2026-03-03,9,"A sharp type-systems article that connects language semantics, API design, and abstraction leaks through a very concrete Elixir example.",kept,,
+189,track2,integration,"error_resilience,elixir_patterns",https://dashbit.co/blog/soft-deletes-with-ecto,Soft deletes with Ecto and PostgreSQL,Dashbit Blog,José Valim,2024-08-13,8,"A practical persistence article on soft deletes and data-modeling tradeoffs, useful for service teams balancing safety with correctness.",kept,,
+190,track2,integration,"api_design,elixir_patterns",https://dashbit.co/blog/sdks-with-req-s3,SDKs with Req: S3,Dashbit Blog,Wojtek Mach,2024-07-18,8,A useful SDK-design article that turns an S3 client into a concrete case study for API ergonomics and service integration patterns.,kept,,
+191,track2,integration,"api_design,elixir_patterns",https://dashbit.co/blog/sdks-with-req-stripe,SDKs with Req: Stripe,Dashbit Blog,Wojtek Mach,2024-06-25,8,"A strong integration article on building SDKs against real APIs, with useful lessons for interface design and failure handling.",kept,,
+192,track2,dx,"elixir_patterns,testing",https://dashbit.co/blog/announcing-phoenix-playground,Announcing Phoenix Playground,Dashbit Blog,Wojtek Mach,2024-06-18,8,A developer-experience article that shows how to lower experimentation cost around Phoenix and LiveView without flattening the real platform model.,kept,,
+193,track2,architecture_patterns,"elixir_patterns,design_patterns",https://dashbit.co/blog/web-apps-have-client-and-server-state,Web apps have client and server state (plus realtime and LiveView),Dashbit Blog,José Valim,2024-06-07,8,"A thoughtful architecture article on state boundaries in modern web apps, useful well beyond Elixir because it names the tradeoffs clearly.",kept,,
+194,track2,ai_assisted,"elixir_patterns,evolutionary",https://dashbit.co/blog/elixir-ml-s1-2024-mlir-arrow-instructor,"Elixir and Machine Learning in 2024 so far: MLIR, Apache Arrow, structured LLM, and more",Dashbit Blog,José Valim,2024-05-29,8,"A strong ecosystem article because it ties Elixir and machine learning work to concrete runtime, tooling, and interoperability advances.",kept,,
+195,track2,dependency_health,"api_design,elixir_patterns",https://dashbit.co/blog/req-v0.5,Req v0.5 released,Dashbit Blog,Wojtek Mach,2024-05-28,8,A useful library-release article that makes client API changes and upgrade implications easy to reason about.,kept,,
+196,track2,testing,"api_design,dx",https://dashbit.co/blog/req-api-client-testing,Req API Client Testing,Dashbit Blog,Wojtek Mach,2024-04-02,8,"A practical testing article for API clients, with concrete patterns for building confidence without overcoupling tests to implementation details.",kept,,
+197,track2,performance,"elixir_patterns,react_patterns",https://dashbit.co/blog/latency-rendering-liveview,Supercharge your app: latency and rendering optimizations in Phoenix LiveView,Dashbit Blog,José Valim,2023-10-17,9,"A strong performance article on rendering and latency behavior in LiveView, with lessons that translate to realtime UI systems more broadly.",kept,,
+198,track2,ai_assisted,"elixir_patterns,evolutionary",https://dashbit.co/blog/elixir-and-machine-learning-q3-roundup,Elixir and Machine Learning: Q3 2023 roundup,Dashbit Blog,José Valim,2023-10-03,8,A useful roundup because it turns scattered ML work in Elixir into a coherent snapshot of ecosystem direction and capability growth.,kept,,
+199,track2,clean_code,"elixir_patterns,type_system",https://dashbit.co/blog/why-the-dot,Why the dot (when calling anonymous functions)?,Dashbit Blog,José Valim,2023-08-14,8,A crisp language-design article on one small syntax choice that opens up much larger lessons about readability and semantics.,kept,,
+200,track2,ai_assisted,"elixir_patterns,evolutionary",https://dashbit.co/blog/elixir-and-machine-learning-nx-v0.1,Elixir and Machine Learning: Nx v0.1 released!,Dashbit Blog,José Valim,2022-01-06,8,A foundational ecosystem article that shows how numerical computing and ML capabilities were being built into Elixir from first principles.,kept,,


--- seed-articles.json
diff --git a/seed-articles.json b/seed-articles.json
index bc8ed27..9b64331 100644
--- a/seed-articles.json
+++ b/seed-articles.json
@@ -1629,5 +1629,773 @@
       "evolutionary",
       "complexity"
     ]
+  },
+  {
+    "url": "https://go.dev/blog/type-construction-and-cycle-detection",
+    "title": "Type Construction and Cycle Detection",
+    "source_name": "The Go Blog",
+    "text": "Go’s static typing is an important part of why Go is a good fit for production systems that have to be robust and reliable. When a Go package is compiled, it is first parsed—meaning that the Go source code within that package is converted into an abstract syntax tree (or AST). This AST is then passed to the Go type checker . In this blog post, we’ll dive into a part of the type checker we significantly improved in Go 1.26. How does this change things from a Go user’s perspective? Unless one is fond of arcane type definitions, there’s no observable change here. This refinement was intended to reduce corner cases, setting us up for future improvements to Go. Also, it’s a fun look at something that seems quite ordinary to Go programmers, but has some real subtleties hiding within. But first, what exactly is type checking ? It’s a step in the Go compiler that eliminates whole classes of errors at compile time. Specifically, the Go type checker verifies that: Types appearing in the AST are valid (for example, a map’s key type must be comparable ). Operations involving those types (or their values) are valid (for example, one can’t add an int and a string ). To accomplish this, the type checker constructs an internal representation for each type it encounters while traversing the AST—a process informally called type construction . As we’ll soon see, even though Go is known for its simple type system, type construction can be deceptively complex in certain corners of the language. Type construction Let’s start by considering a simple pair of type declarations: type T []U type U *int When the type checker is invoked, it first encounters the type declaration for T . Here, the AST records a type definition of a type name T and a type expression []U . T is a defined type ; to represent the actual data structure that the type checker uses when constructing defined types, we’ll use a Defined struct. The Defined struct contains a pointer to the type for the type expression to the right of the type name. This underlying field is relevant for sourcing the type’s underlying type . To help illustrate the type checker’s state, let’s see how walking the AST fills in the data structures, starting with: At this point, T is under construction , indicated by the color yellow. Since we haven’t evaluated the type expression []U yet—it’s still black— underlying points to nil , indicated by an open arrow. When we evaluate []U , the type checker constructs a Slice struct, the internal data structure used to represent slice types. Similarly to Defined , it contains a pointer to the element type for the slice. We don’t yet know what the name U refers to, though we expect it to refer to a type. So, again, this pointer is nil . We are left with: By now you might be getting the gist, so we’ll pick up the pace a bit. To convert the type name U to a type, we first locate its declaration. Upon seeing that it represents another defined type, we construct a separate Defined for U accordingly. Inspecting the right side of U , we see the type expression *int , which evaluates to a Pointer struct, with the base type of the pointer being the type expression int . When we evaluate int , something special happens: we get back a predeclared type. Predeclared types are constructed before the type checker even begins walking the AST. Since the type for int is already constructed, there’s nothing for us to do but point to that type. We now have: Note that the Pointer type is complete at this point, indicated by the color green. Completeness means that the type’s internal data structure has all of its fields populated and any types pointed to by those fields are complete. Completeness is an important property of a type because it ensures that accessing the internals, or deconstruction , of that type is sound: we have all the information describing the type. In the image above, the Pointer struct only contains a base field, which points to int . Since int has no fields to populate, it’s “vacuously” complete, making the type for *int complete. From here, the type checker begins unwinding the stack. Since the type for *int is complete, we can complete the type for U , meaning we can complete the type for []U , and so on for T . When this process ends, we are left with only complete types, as shown below: The numbering above shows the order in which the types were completed (after the Pointer ). Note that the type on the bottom completed first. Type construction is naturally a depth-first process, since completing a type requires its dependencies to be completed first. Recursive types With this simple example out of the way, let’s add a bit more nuance. Go’s type system also allows us to express recursive types. A typical example is something like: type Node struct { next *Node } If we reconsider our example from above, we can add a bit of recursion by swapping *int for *T like so: type T []U type U *T Now for a trace: let’s start once more with T , but skip ahead to illustrate the effects of this change. As one might suspect from our previous example, the type checker will approach the evaluation of *T with the below state: The question is what to do with the base type for *T . We have an idea of what T is (a Defined ), but it’s currently being constructed (its underlying is still nil ). We simply point the base type for *T to T , even though T is incomplete: We do this assuming that T will complete when it finishes construction in the future (by pointing to a complete type). When that happens, base will point to a complete type, thus making *T complete. In the meantime, we’ll begin heading back up the stack: When we get back to the top and finish constructing T , the “loop” of types will close, completing each type in the loop simultaneously: Before we considered recursive types, evaluating a type expression always returned a complete type. That was a convenient property because it meant the type checker could always deconstruct (look inside) a type returned from evaluation. But in the example above , evaluation of T returned an incomplete type, meaning deconstructing T is unsound until it completes. Generally speaking, recursive types mean that the type checker can no longer assume that types returned from evaluation will be complete. Yet, type checking involves many checks which require deconstructing a type. A classic example is confirming that a map key is comparable , which requires inspecting the underlying field. How do we safely interact with incomplete types like T ? Recall that type completeness is a prerequisite for deconstructing a type. In this case, type construction never deconstructs a type, it merely refers to types. In other words, type completeness does not block type construction here. Because type construction isn’t blocked, the type checker can simply delay such checks until the end of type checking, when all types are complete (note that the checks themselves also do not block type construction). If a type were to reveal a type error, it makes no difference when that error is reported during type checking—only that it is reported eventually. With this knowledge in mind, let’s examine a more complex example involving values of incomplete types. Recursive types and values Let’s take a brief detour and have a look at Go’s array types . Importantly, array types have a size, which is a constant that is part of the type. Some operations, like the built-in functions unsafe.Sizeof and len can return constants when applied to certain values or expressions , meaning they can appear as array sizes. Importantly, the values passed to those functions can be of any type, even an incomplete type. We call these incomplete values . Let’s consider this example: type T [unsafe.Sizeof(T{})]int In the same way as before, we’ll reach a state like the one below: To construct the Array , we must calculate its size. From the value expression unsafe.Sizeof(T{}) , that’s the size of T . For array types (such as T ), calculating their size requires deconstruction: we need to look inside the type to determine the length of the array and size of each element. In other words, type construction for the Array does deconstruct T , meaning the Array cannot finish construction (let alone complete) before T completes. The “loop” trick that we used earlier—where a loop of types simultaneously completes as the type starting the loop finishes construction—doesn’t work here. This leaves us in a bind: T cannot be completed until the Array completes. The Array cannot be completed until T completes. They cannot be completed simultaneously (unlike before). Clearly, this is impossible to satisfy. What is the type checker to do? Cycle detection Fundamentally, code such as this is invalid because the size of T cannot be determined without knowing the size of T , regardless of how the type checker operates. This particular instance—cyclic size definition—is part of a class of errors called cycle errors , which generally involve cyclic definition of Go constructs. As another example, consider type T T , which is also in this class, but for different reasons. The process of finding and reporting cycle errors in the course of type checking is called cycle detection . Now, how does cycle detection work for type T [unsafe.Sizeof(T{})]int ? To answer this, let’s look at the inner T{} . Because T{} is a composite literal expression, the type checker knows that its resulting value is of type T . Because T is incomplete, we call the value T{} an incomplete value . We must be cautious—operating on an incomplete value is only sound if it doesn’t deconstruct the value’s type. For example, type T [unsafe.Sizeof(new(T))]int is sound, since the value new(T) (of type *T ) is never deconstructed—all pointers have the same size. To reiterate, it is sound to size an incomplete value of type *T , but not one of type T . This is because the “pointerness” of *T provides enough type information for unsafe.Sizeof , whereas just T does not. In fact, it’s never sound to operate on an incomplete value whose type is a defined type , because a mere type name conveys no (underlying) type information at all. Where to do it Up to now we’ve focused on unsafe.Sizeof directly operating on potentially incomplete values. In type T [unsafe.Sizeof(T{})]int , the call to unsafe.Sizeof is just the “root” of the array length expression. We can readily imagine the incomplete value T{} as an operand in some other value expression. For example, it could be passed to a function (i.e. type T [unsafe.Sizeof(f(T{}))]int ), sliced (i.e. type T [unsafe.Sizeof(T{}[:])]int ), indexed (i.e. type T [unsafe.Sizeof(T{}[0])]int ), etc. All of these are invalid because they require deconstructing T . For instance, indexing T requires checking the underlying type of T . Because these expressions “consume” potentially incomplete values, let’s call them downstreams . There are many more examples of downstream operators, some of which are not syntactically obvious. Similarly, T{} is just one example of an expression that “produces” a potentially incomplete value—let’s call these kinds of expressions upstreams : Comparatively, there are fewer and more syntactically obvious value expressions that might result in incomplete values. Also, it’s rather simple to enumerate these cases by inspecting Go’s syntax definition. For these reasons, it’ll be simpler to implement our cycle detection logic via the upstreams, where potentially incomplete values originate. Below are some examples of them: type T [unsafe.Sizeof(T(42))]int // conversion func f() T type T [unsafe.Sizeof(f())]int // function call var i interface{} type T [unsafe.Sizeof(i.(T))]int // assertion type T [unsafe.Sizeof(<-(make(<-chan T)))]int // channel receive type T [unsafe.Sizeof(make(map[int]T)[42])]int // map access type T [unsafe.Sizeof(*new(T))]int // dereference // ... and a handful more For each of these cases, the type checker has extra logic where that particular kind of value expression is evaluated. As soon as we know the type of the resulting value, we insert a simple test that checks that the type is complete. For instance, in the conversion example type T [unsafe.Sizeof(T(42))]int , there is a snippet in the type checker that resembles: func callExpr(call *syntax.CallExpr) operand { x := typeOrValue(call.Fun) switch x.mode() { // ... other cases case typeExpr: // T(), meaning it's a conversion T := x.typ() // ... handle the conversion, T *is not* safe to deconstruct } } As soon as we observe that the CallExpr is a conversion to T , we know that the resulting type will be T (assuming no preceding errors). Before we pass back a value (here, an operand ) of type T to the rest of the type checker, we need to check for completeness of T : func callExpr(call *syntax.CallExpr) operand { x := typeOrValue(call.Fun) switch x.mode() { // ... other cases case typeExpr: // T(), meaning it's a conversion T := x.typ() + if !isComplete(T) { + reportCycleErr(T) + return invalid + } // ... handle the conversion, T *is* safe to deconstruct } } Instead of returning an incomplete value, we return a special invalid operand, which signals that the call expression could not be evaluated. The rest of the type checker has special handling for invalid operands. By adding this, we prevented incomplete values from “escaping” downstream—both into the rest of the type conversion logic and to downstream operators—and instead reported a cycle error describing the problem with T . A similar code pattern is used in all other cases, implementing cycle detection for incomplete values. Conclusion Systematic cycle detection involving incomplete values is a new addition to the type checker. Before Go 1.26, we used a more complex type construction algorithm, which involved more bespoke cycle detection that didn’t always work. Our new, simpler approach addressed a number of (admittedly esoteric) compiler panics (issues #75918 , #76383 , #76384 , #76478 , and more), resulting in a more stable compiler. As programmers, we’ve become accustomed to features like recursive type definitions and sized array types such that we might overlook the nuance of their underlying complexity. While this post does skip over some finer details, hopefully we’ve conveyed a deeper understanding of (and perhaps appreciation for) the problems surrounding type checking in Go.",
+    "quality_score": 9,
+    "modules": [
+      "go_patterns",
+      "type_system",
+      "complexity"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/inliner",
+    "title": "//go:fix inline and the source-level inliner",
+    "source_name": "The Go Blog",
+    "text": "Go 1.26 contains an all-new implementation of the go fix subcommand, designed to help you keep your Go code up-to-date and modern. For an introduction, start by reading our recent post on the topic. In this post, we’ll look at one particular feature, the source-level inliner. While go fix has several bespoke modernizers for specific new language and library features, the source-level inliner is the first fruit of our efforts to provide “ self-service ” modernizers and analyzers. It enables any package author to express simple API migrations and updates in a straightforward and safe way. We’ll first explain what the source-level inliner is and how you can use it, then we’ll dive into some aspects of the problem and the technology behind it. Source-level inlining In 2023, we built an algorithm for source-level inlining of function calls in Go. To “inline” a call means to replace the call by a copy of the body of the called function, substituting arguments for parameters. We call it “source-level” inlining because it durably modifies the source code. By contrast, the inlining algorithm found in a typical compiler, including Go’s, applies a similar transformation, but to the compiler’s ephemeral intermediate representation , to generate more efficient code. If you’ve ever invoked gopls ’ “ Inline call ” interactive refactoring, you’ve used the source-level inliner. (In VS Code, this code action can be found on the “Source Action…” menu.) The before-and-after screenshots below show the effect of inlining the call to sum from the function named six . The inliner is a crucial building block for a number of source transformation tools. For example, gopls uses it for the “Change signature” and “Remove unused parameter” refactorings because, as we’ll see below, it takes care of many subtle correctness issues that arise when refactoring function calls. This same inliner is also one of the analyzers in the all-new go fix command. In go fix , it enables self-service API migration and upgrades using a new //go:fix inline directive comment. Let’s take a look at a few examples of how this works and what it can be used for. Example: renaming ioutil.ReadFile In Go 1.16, the ioutil.ReadFile function, which reads the content of a file, was deprecated in favor of the new os.ReadFile function. In effect, the function was renamed, though of course Go’s compatibility promise prevents us from ever removing the old name. package ioutil import \"os\" // ReadFile reads the file named by filename… // Deprecated: As of Go 1.16, this function simply calls [os.ReadFile]. func ReadFile(filename string) ([]byte, error) { return os.ReadFile(filename) } Ideally, we would like to change every Go program in the world to stop using ioutil.ReadFile and to call os.ReadFile instead. The inliner can help us do that. First we annotate the old function with //go:fix inline . This comment tells the tool that any time it sees a call to this function, it should inline the call. package ioutil import \"os\" // ReadFile reads the file named by filename… // Deprecated: As of Go 1.16, this function simply calls [os.ReadFile]. //go:fix inline func ReadFile(filename string) ([]byte, error) { return os.ReadFile(filename) } When we run go fix on a file containing a call to ioutil.ReadFile , it applies the replacement: $ go fix -diff ./... -import \"io/ioutil\" +import \"os\" - data, err := ioutil.ReadFile(\"hello.txt\") + data, err := os.ReadFile(\"hello.txt\") The call has been inlined, in effect replacing a call to one function by a call to another. Because the inliner replaces a function call by a copy of the body of the called function, not by some arbitrary expression, in principle the transformation should not change the program’s behavior (barring code that inspects the call stack, of course). This differs from other tools that allow for arbitrary rewrites, such as gofmt -r , which are very powerful but need to be watched closely. For many years now, our Google colleagues on the teams supporting Java, Kotlin, and C++ have been using source-level inliner tools like this. To date, these tools have eliminated millions of calls to deprecated functions in Google’s code base. Users simply add the directives, and wait. During the night, robots quietly prepare, test, and submit batches of code changes across a monorepo of billions of lines of code. If all goes well, by the morning the old code is no longer in use and can be safely deleted. Go’s inliner is a relative newcomer, but it has already been used to prepare more than 18,000 changelists to Google’s monorepo. Example: fixing API design flaws With a little creativity, a variety of migrations can be expressed as inlinings. Consider this hypothetical oldmath package: // Package oldmath is the bad old math package. package oldmath // Sub returns x - y. func Sub(y, x int) int // Inf returns positive infinity. func Inf() float64 // Neg returns -x. func Neg(x int) int It has several design flaws: the Sub function declares its parameters in the wrong order; the Inf function implicitly prefers one of the two infinities; and the Neg function is redundant with Sub . Fortunately we have a newmath package that avoids these mistakes, and we’d like to get users to switch to it. The first step is to implement the old API in terms of the new package and to deprecate the old functions. Then we add inliner directives: // Package oldmath is the bad old math package. package oldmath import \"newmath\" // Sub returns x - y. // Deprecated: the parameter order is confusing. //go:fix inline func Sub(y, x int) int { return newmath.Sub(x, y) } // Inf returns positive infinity. // Deprecated: there are two infinite values; be explicit. //go:fix inline func Inf() float64 { return newmath.Inf(+1) } // Neg returns -x. // Deprecated: this function is unnecessary. //go:fix inline func Neg(x int) int { return newmath.Sub(0, x) } Now, when users of oldmath run the go fix command on their code, it will replace all calls to the old functions by their new counterparts. By the way, gopls has included inline in its analyzer suite for some time, so if your editor uses gopls, the moment you add the //go:fix inline directives you should start seeing a diagnostic at each call site, such as “call of oldmath.Sub should be inlined”, along with a suggested fix that inlines that particular call. For example, this old code: import \"oldmath\" var nine = oldmath.Sub(1, 10) // diagnostic: \"call to oldmath.Sub should be inlined\" will be transformed to: import \"newmath\" var nine = newmath.Sub(10, 1) Observe that after the fix, the arguments to Sub are in the logical order. This is progress! If you’re in luck, the inliner will succeed at removing every call to the functions in oldmath , perhaps allowing you to delete it as a dependency. The inline analyzer works on types and constants too. If our oldmath package had originally declared a data type for rational numbers and a constant for π, we could use the following forwarding declarations to migrate them to the newmath package while preserving the behavior of existing code: package oldmath //go:fix inline type Rational = newmath.Rational //go:fix inline const Pi = newmath.Pi Each time the inline analyzer encounters a reference to oldmath.Rational or oldmath.Pi , it will update them to refer instead to newmath . Under the hood of the inliner At a glance, source inlining seems straightforward: just replace the call with the body of the callee function, introduce variables for the function parameters, and bind the call arguments to those variables. But handling all of the complexities and corner cases correctly while producing acceptable results is no small technical challenge: the inliner is about 7,000 lines of dense, compiler-like logic. Let’s look at six aspects of the problem that make it so tricky. 1. Parameter elimination One of the inliner’s most important tasks is to attempt to replace each occurrence of a parameter in the callee by its corresponding argument from the call. In the simplest case, the argument is a trivial literal such as 0 or \"\" , so the replacement is straightforward and the parameter can be eliminated. //go:fix inline func show(prefix, item string) { fmt.Println(prefix, item) } show(\"\", \"hello\") fmt.Println(\"\", \"hello\") For less trivial literals such as 404 or \"go.dev\" , the replacement is equally straightforward, so long as the parameter appears in the callee at most once. But if it appears multiple times, it would be bad style to sprinkle copies of these magic values throughout the code as it would obscure the relationship between them; a later change to only one of them might create an inconsistency. In such cases the inliner must tread carefully and emit a more conservative result. Whenever one or more parameters cannot be completely substituted for any reason, the inliner inserts an explicit “parameter binding” declaration: //go:fix inline func printPair(before, x, y, after string) { fmt.Println(before, x, after) fmt.Println(before, y, after) } printPair(\"[\", \"one\", \"two\", \"]\") // a “parameter binding” declaration var before, after = \"[\", \"]\" fmt.Println(before, \"one\", after) fmt.Println(before, \"two\", after) 2. Side effects In Go, as in all imperative programming languages, calling a function may have the side effect of updating variables, which in turn may affect the behavior of other functions. Consider the call to add below: func add(x, y int) int { return y + x } z = add(f(), g()) A trivial inlining of the call would replace x with f() and y with g() , with this result: z = g() + f() But this result is incorrect because evaluation of g() now occurs before f() ; if the two functions have side effects, those effects will now be observed in a different order and may affect the result of the expression. Of course, it is bad form to write code that relies on effect ordering among call arguments, but that doesn’t mean people don’t do it, and our tools have to get it right. So, the inliner must attempt to prove that f() and g() do not have side effects on each other. On success, it can safely proceed with the result above. Otherwise, it must fall back to an explicit parameter binding: var x = f() z = g() + x When considering side effects, it’s not only the argument expressions that matter. Also significant is the order in which parameters are evaluated relative to other code in the callee. Consider this call to add2 : //go:fix inline func add2(x, y int) int { return x + other() + y } add2(f(), g()) This time, parameters x and y are used in the same order they are declared, so the substitution f() + other() + g() won’t change the order of effects of f() and g() —but it will change the order of any effects of other() and g() . Furthermore, if the function body uses a parameter within a loop, substitution might change the cardinality of effects. The inliner uses a novel hazard analysis to model the order of effects in each callee function. Nonetheless, its ability to construct the necessary safety proofs is quite limited. For example, if the calls f() and g() are simple accessors, it would be perfectly safe to call them in either order. Indeed, an optimizing compiler might use its knowledge of the internals of f and g to safely reorder the two calls. But unlike a compiler, which generates object code that reflects the source at a specific moment, the purpose of the inliner is to make permanent changes to the source, so it can’t take advantage of ephemeral details. As an extreme example, consider this start function: func start() { /* TODO: implement */ } An optimizing compiler is free to delete each call to start() because it has no effects today, but the inliner is not, because it may become important tomorrow. In short, the inliner may produce results that—to the informed eye of a project maintainer—are clearly too conservative. In such cases, the fixed code would benefit stylistically from a little manual cleanup. 3. “Fallible” constant expressions You might imagine (as I once did) that it would always be safe to replace a parameter variable by a constant argument of the same type. Surprisingly, this turns out not to be the case, because some checks previously done at run time would now happen—and fail—at compile time. Consider this call to the index function: //go:fix inline func index(s string, i int) byte { return s[i] } index(\"\", 0) A naive inliner might replace s with \"\" and i with 0 , resulting in \"\"[0] , but this is not actually a legal Go expression because this particular index is out of bounds for this particular string. Because the expression \"\"[0] is composed of constants, it is evaluated at compile time, and a program that contains it will not even build. By contrast, the original program would fail only if execution reaches this call to index , which presumably in a working program it does not. Consequently, the inliner must keep track of all expressions and their operands that might become constant during parameter substitution, triggering additional compile-time checks. It builds a constraint system and attempts to solve it. Each unsatisfied constraint is resolved by adding an explicit binding for the constrained parameters. 4. Shadowing Typical argument expressions contain one or more identifiers that refer to symbols (variables, functions, and so on) in the caller’s file. The inliner must make sure that each name in the argument expression would refer to the same symbol after parameter substitution; in other words, none of the caller’s names is shadowed in the callee. If this fails, the inliner must again insert parameter bindings, as in this example: //go:fix inline func f(val string) { x := 123 fmt.Println(val, x) } x := \"hello\" f(x) x := \"hello\" { // another “parameter binding” declaration // to read the caller's x before shadowing it var val string = x x := 123 fmt.Println(val, x) } Conversely, the inliner must also check that each name in the callee function body would refer to the same thing when it is spliced into the call site. In other words, none of the callee’s names is shadowed or missing in the caller. For missing names, the inliner may need to insert additional imports. 5. Unused variables When an argument expression has no effects and its corresponding parameter is never used, the expression may be eliminated. However, if the expression contains the last reference to a local variable at the caller, this may cause a compile error because the variable is now unused. //go:fix inline func f(_ int) { print(\"hello\") } x := 42 f(x) x := 42 // error: unused variable: x print(\"hello\") So the inliner must account for references to local variables and avoid removing the last one. (Of course it is still possible that two different inliner fixes each remove the second -to-last reference to a variable, so the two fixes are valid in isolation but not together; see the discussion of semantic conflicts in the previous post. Unfortunately manual cleanup is inevitably required in this case.) 6. Defer In some cases, it is simply impossible to inline away the call. Consider a call to a function that uses a defer statement: if we were to eliminate the call, the deferred function would execute when the caller function returns, which is too late. All we can safely do when the callee uses defer is to put the body of the callee in a function literal and immediately call it. This function literal, func() { … }() , delimits the lifetime of the defer statement, as in this example: //go:fix inline func callee() { defer f() … } callee() func() { defer f() … }() If you invoke the inliner in gopls, you’ll see that it makes the change shown above and introduces the function literal. This result may be appropriate in an interactive setting, since you are likely to immediately tweak the code (or undo the fix) as you prefer, but it is rarely desirable in a batch tool, so as a matter of policy the analyzer in go fix refuses to inline such “literalized” calls. An optimizing compiler for “tidiness” We’ve now seen half a dozen examples of how the inliner handles tricky semantic edge cases correctly. (Many thanks to Rob Findley, Jonathan Amsterdam, Olena Synenka, and Lasse Folger for insights, discussions, reviews, features, and fixes.) By putting all of the smarts into the inliner, users can simply apply an “Inline call” refactoring in their IDE or add a //go:fix inline directive to their own functions and be confident that the resulting code transformations can be applied with only the most cursory review. Although we have made good progress toward that goal, we have not yet fully attained it, and it is likely that we never will. Consider a compiler. A sound compiler produces correct output for any input and never miscompiles your code; this is the fundamental expectation that every user should have of their compiler. An optimizing compiler produces code carefully chosen for speed without compromising on safety. Similarly, an inliner is a bit like an optimizing compiler whose goal is not speed but tidiness : inlining a call must never change the behavior of your program, and ideally it produces code that is maximally neat and tidy. Unfortunately, an optimizing compiler is provably never done: showing that two different programs are equivalent is an undecidable problem, and there will always be improvements that an expert knows are safe but the compiler cannot prove. So too with the inliner: there will always be cases where the inliner’s output is too fussy or otherwise stylistically inferior to that of a human expert, and there will always be more “tidiness optimizations” to add. Try it out! We hope this tour of the inliner gives you a sense of some of the challenges involved, and of our priorities and directions in providing sound, self-service code transformation tools. Please try out the inliner, either interactively in your IDE, or through //go:fix inline directives and the go fix command, and share with us your experiences and any ideas you have for further improvements or new tools.",
+    "quality_score": 8,
+    "modules": [
+      "clean_code",
+      "performance",
+      "go_patterns"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/allocation-optimizations",
+    "title": "Allocating on the Stack",
+    "source_name": "The Go Blog",
+    "text": "We’re always looking for ways to make Go programs faster. In the last 2 releases, we have concentrated on mitigating a particular source of slowness, heap allocations. Each time a Go program allocates memory from the heap, there’s a fairly large chunk of code that needs to run to satisfy that allocation. In addition, heap allocations present additional load on the garbage collector. Even with recent enhancements like Green Tea , the garbage collector still incurs substantial overhead. So we’ve been working on ways to do more allocations on the stack instead of the heap. Stack allocations are considerably cheaper to perform (sometimes completely free). Moreover, they present no load to the garbage collector, as stack allocations can be collected automatically together with the stack frame itself. Stack allocations also enable prompt reuse, which is very cache friendly. Stack allocation of constant-sized slices Consider the task of building a slice of tasks to process: func process(c chan task) { var tasks []task for t := range c { tasks = append(tasks, t) } processAll(tasks) } Let’s walk through what happens at runtime when pulling tasks from the channel c and adding them to the slice tasks . On the first loop iteration, there is no backing store for tasks , so append has to allocate one. Because it doesn’t know how big the slice will eventually be, it can’t be too aggressive. Currently, it allocates a backing store of size 1. On the second loop iteration, the backing store now exists, but it is full. append again has to allocate a new backing store, this time of size 2. The old backing store of size 1 is now garbage. On the third loop iteration, the backing store of size 2 is full. append again has to allocate a new backing store, this time of size 4. The old backing store of size 2 is now garbage. On the fourth loop iteration, the backing store of size 4 has only 3 items in it. append can just place the item in the existing backing store and bump up the slice length. Yay! No call to the allocator for this iteration. On the fifth loop iteration, the backing store of size 4 is full, and append again has to allocate a new backing store, this time of size 8. And so on. We generally double the size of the allocation each time it fills up, so we can eventually append most new tasks to the slice without allocation. But there is a fair amount of overhead in the “startup” phase when the slice is small. During this startup phase we spend a lot of time in the allocator, and produce a bunch of garbage, which seems pretty wasteful. And it may be that in your program, the slice never really gets large. This startup phase may be all you ever encounter. If this code was a really hot part of your program, you might be tempted to start the slice out at a larger size, to avoid all of these allocations. func process2(c chan task) { tasks := make([]task, 0, 10) // probably at most 10 tasks for t := range c { tasks = append(tasks, t) } processAll(tasks) } This is a reasonable optimization to do. It is never incorrect; your program still runs correctly. If the guess is too small, you get allocations from append as before. If the guess is too large, you waste some memory. If your guess for the number of tasks was a good one, then there’s only one allocation site in this program. The make call allocates a slice backing store of the correct size, and append never has to do any reallocation. The surprising thing is that if you benchmark this code with 10 elements in the channel, you’ll see that you didn’t reduce the number of allocations to 1, you reduced the number of allocations to 0! The reason is that the compiler decided to allocate the backing store on the stack. Because it knows what size it needs to be (10 times the size of a task) it can allocate storage for it in the stack frame of process2 instead of on the heap 1 . Note that this depends on the fact that the backing store does not escape to the heap inside of processAll . Stack allocation of variable-sized slices But of course, hard coding a size guess is a bit rigid. Maybe we can pass in an estimated length? func process3(c chan task, lengthGuess int) { tasks := make([]task, 0, lengthGuess) for t := range c { tasks = append(tasks, t) } processAll(tasks) } This lets the caller pick a good size for the tasks slice, which may vary depending on where this code is being called from. Unfortunately, in Go 1.24 the non-constant size of the backing store means the compiler can no longer allocate the backing store on the stack. It will end up on the heap, converting our 0-allocation code to 1-allocation code. Still better than having append do all the intermediate allocations, but unfortunate. But never fear, Go 1.25 is here! Imagine you decide to do the following, to get the stack allocation only in cases where the guess is small: func process4(c chan task, lengthGuess int) { var tasks []task if lengthGuess <= 10 { tasks = make([]task, 0, 10) } else { tasks = make([]task, 0, lengthGuess) } for t := range c { tasks = append(tasks, t) } processAll(tasks) } Kind of ugly, but it would work. When the guess is small, you use a constant size make and thus a stack-allocated backing store, and when the guess is larger you use a variable size make and allocate the backing store from the heap. But in Go 1.25, you don’t need to head down this ugly road. The Go 1.25 compiler does this transformation for you! For certain slice allocation locations, the compiler automatically allocates a small (currently 32-byte) slice backing store, and uses that backing store for the result of the make if the size requested is small enough. Otherwise, it uses a heap allocation as normal. In Go 1.25, process3 performs zero heap allocations, if lengthGuess is small enough that a slice of that length fits into 32 bytes. (And of course that lengthGuess is a correct guess for how many items are in c .) We’re always improving the performance of Go, so upgrade to the latest Go release and be surprised by how much faster and memory efficient your program becomes! Stack allocation of append-allocated slices Ok, but you still don’t want to have to change your API to add this weird length guess. Anything else you could do? Upgrade to Go 1.26! func process(c chan task) { var tasks []task for t := range c { tasks = append(tasks, t) } processAll(tasks) } In Go 1.26, we allocate the same kind of small, speculative backing store on the stack, but now we can use it directly at the append site. On the first loop iteration, there is no backing store for tasks , so append uses a small, stack-allocated backing store as the first allocation. If, for instance, we can fit 4 task s in that backing store, the first append allocates a backing store of length 4 from the stack. The next 3 loop iterations append directly to the stack backing store, requiring no allocation. On the 4th iteration, the stack backing store is finally full and we have to go to the heap for more backing store. But we have avoided almost all of the startup overhead described earlier in this article. No heap allocations of size, 1, 2, and 4, and none of the garbage that they eventually become. If your slices are small, maybe you will never have a heap allocation. Stack allocation of append-allocated escaping slices Ok, this is all good when the tasks slice doesn’t escape. But what if I’m returning the slice? Then it can’t be allocated on the stack, right? Right! The backing store for the slice returned by extract below can’t be allocated on the stack, because the stack frame for extract disappears when extract returns. func extract(c chan task) []task { var tasks []task for t := range c { tasks = append(tasks, t) } return tasks } But you might think, the returned slice can’t be allocated on the stack. But what about all those intermediate slices that just become garbage? Maybe we can allocate those on the stack? func extract2(c chan task) []task { var tasks []task for t := range c { tasks = append(tasks, t) } tasks2 := make([]task, len(tasks)) copy(tasks2, tasks) return tasks2 } Then the tasks slice never escapes extract2 . It can benefit from all of the optimizations described above. Then at the very end of extract2 , when we know the final size of the slice, we do one heap allocation of the required size, copy our task s into it, and return the copy. But do you really want to write all that additional code? It seems error prone. Maybe the compiler can do this transformation for us? In Go 1.26, it can! For escaping slices, the compiler will transform the original extract code to something like this: func extract3(c chan task) []task { var tasks []task for t := range c { tasks = append(tasks, t) } tasks = runtime.move2heap(tasks) return tasks } runtime.move2heap is a special compiler+runtime function that is the identity function for slices that are already allocated in the heap. For slices that are on the stack, it allocates a new slice on the heap, copies the stack-allocated slice to the heap copy, and returns the heap copy. This ensures that for our original extract code, if the number of items fits in our small stack-allocated buffer, we perform exactly 1 allocation of exactly the right size. If the number of items exceeds the capacity of our small stack-allocated buffer, we do our normal doubling-allocation once the stack-allocated buffer overflows. The optimization that Go 1.26 does is actually better than the hand-optimized code, because it does not require the extra allocation+copy that the hand-optimized code always does at the end. It requires the allocation+copy only in the case that we’ve exclusively operated on a stack-backed slice up to the return point. We do pay the cost for a copy, but that cost is almost completely offset by the copies in the startup phase that we no longer have to do. (In fact, the new scheme at worst has to copy one more element than the old scheme.) Wrapping up Hand optimization can still be beneficial, especially if you have a good estimate of the slice size ahead of time. But hopefully the compiler will now catch a lot of the simple cases for you and allow you to focus on the remaining ones that really matter. There are a lot of details that the compiler needs to ensure to get all these optimizations right. If you think that one of these optimizations is causing correctness or (negative) performance issues for you, you can turn them off with -gcflags=all=-d=variablemakehash=n . If turning these optimizations off helps, please file an issue so we can investigate. Footnotes 1 Go stacks do not have any alloca -style mechanism for dynamically-sized stack frames. All Go stack frames are constant sized.",
+    "quality_score": 9,
+    "modules": [
+      "performance",
+      "go_patterns",
+      "complexity"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/gofix",
+    "title": "Using go fix to modernize Go code",
+    "source_name": "The Go Blog",
+    "text": "The 1.26 release of Go this month includes a completely rewritten go fix subcommand. Go fix uses a suite of algorithms to identify opportunities to improve your code, often by taking advantage of more modern features of the language and library. In this post, we’ll first show you how to use go fix to modernize your Go codebase. Then in the second section we’ll dive into the infrastructure behind it and how it is evolving. Finally, we’ll present the theme of “self-service” analysis tools to help module maintainers and organizations encode their own guidelines and best practices. Running go fix The go fix command, like go build and go vet , accepts a set of patterns that denote packages. This command fixes all packages beneath the current directory: $ go fix ./... On success, it silently updates your source files. It discards any fix that touches generated files since the appropriate fix in that case is to the logic of the generator itself. We recommend running go fix over your project each time you update your build to a newer Go toolchain release. Since the command may fix hundreds of files, start from a clean git state so that the change consists only of edits from go fix; your code reviewers will thank you. To preview the changes the above command would have made, use the -diff flag: $ go fix -diff ./... --- dir/file.go (old) +++ dir/file.go (new) - eq := strings.IndexByte(pair, '=') - result[pair[:eq]] = pair[1+eq:] + before, after, _ := strings.Cut(pair, \"=\") + result[before] = after … You can list the available fixers by running this command: $ go tool fix help … Registered analyzers: any replace interface{} with any buildtag check //go:build and // +build directives fmtappendf replace []byte(fmt.Sprintf) with fmt.Appendf forvar remove redundant re-declaration of loop variables hostport check format of addresses passed to net.Dial inline apply fixes based on 'go:fix inline' comment directives mapsloop replace explicit loops over maps with calls to maps package minmax replace if/else statements with calls to min or max … Adding the name of a particular analyzer shows its complete documentation: $ go tool fix help forvar forvar: remove redundant re-declaration of loop variables The forvar analyzer removes unnecessary shadowing of loop variables. Before Go 1.22, it was common to write `for _, x := range s { x := x ... }` to create a fresh variable for each iteration. Go 1.22 changed the semantics of `for` loops, making this pattern redundant. This analyzer removes the unnecessary `x := x` statement. This fix only applies to `range` loops. By default, the go fix command runs all analyzers. When fixing a large project it may reduce the burden of code review if you apply fixes from the most prolific analyzers as separate code changes. To enable only specific analyzers, use the flags matching their names. For example, to run just the any fixer, specify the -any flag. Conversely, to run all the analyzers except selected ones, negate the flags, for instance -any=false . As with go build and go vet , each run of the go fix command analyzes only a specific build configuration. If your project makes heavy use of files tagged for different CPUs or platforms, you may wish to run the command more than once with different values of GOARCH and GOOS for better coverage: $ GOOS=linux GOARCH=amd64 go fix ./... $ GOOS=darwin GOARCH=arm64 go fix ./... $ GOOS=windows GOARCH=amd64 go fix ./... Running the command more than once also provides opportunities for synergistic fixes, as we’ll see below. Modernizers The introduction of generics in Go 1.18 marked the end of an era of very few changes to the language spec and the start of a period of more rapid—though still careful—change, especially in the libraries. Many of the trivial loops that Go programmers routinely write, such as to gather the keys of a map into a slice, can now be conveniently expressed as a call to a generic function such as maps.Keys . Consequently these new features create many opportunities to simplify existing code. In December 2024, during the frenzied adoption of LLM coding assistants, we became aware that such tools tended—unsurprisingly—to produce Go code in a style similar to the mass of Go code used during training, even when there were newer, better ways to express the same idea. Less obviously, the same tools often refused to use the newer ways even when directed to do so in general terms such as “always use the latest idioms of Go 1.25.” In some cases, even when explicitly told to use a feature, the model would deny that it existed. (See my 2025 GopherCon talk for more exasperating details.) To ensure that future models are trained on the latest idioms, we need to ensure that these idioms are reflected in the training data, which is to say the global corpus of open-source Go code. Over the past year, we have built dozens of analyzers to identify opportunities for modernization. Here are three examples of the fixes they suggest: minmax replaces an if statement by a use of Go 1.21’s min or max functions: x := f() if x < 0 { x = 0 } if x > 100 { x = 100 } x := min(max(f(), 0), 100) rangeint replaces a 3-clause for loop by a Go 1.22 range -over-int loop: for i := 0; i < n; i++ { f() } for range n { f() } stringscut (whose -diff output we saw earlier) replaces uses of strings.Index and slicing by Go 1.18’s strings.Cut : i := strings.Index(s, \":\") if i >= 0 { return s[:i] } before, _, ok := strings.Cut(s, \":\") if ok { return before } These modernizers are included in gopls , to provide instant feedback as you type, and in go fix , so that you can modernize several entire packages at once in a single command. In addition to making code clearer, modernizers may help Go programmers learn about newer features. As part of the process of approving each new change to the language and standard library, the proposal review group now considers whether it should be accompanied by a modernizer. We expect to add more modernizers with each release. Example: a modernizer for Go 1.26’s new(expr) Go 1.26 includes a small but widely useful change to the language specification. The built-in new function creates a new variable and returns its address. Historically, its sole argument was required to be a type, such as new(string) , and the new variable was initialized to its “zero” value, such as \"\" . In Go 1.26, the new function may be called with any value, causing it to create a variable initialized to that value, avoiding the need for an additional statement. For example: ptr := new(string) *ptr = \"go1.25\" ptr := new(\"go1.26\") This feature filled a gap that had been discussed for over a decade and resolved one of the most popular proposals for a change to the language. It is especially convenient in code that uses a pointer type *T to indicate an optional value of type T , as is common when working with serialization packages such as json.Marshal or protocol buffers . This is such a common pattern that people often capture it in a helper, such as the newInt function below, saving the caller from the need to break out of an expression context to introduce additional statements: type RequestJSON struct { URL string Attempts *int // (optional) } data, err := json.Marshal(&RequestJSON{ URL: url, Attempts: newInt(10), }) func newInt(x int) *int { return &x } Helpers such as newInt are so frequently needed with protocol buffers that the proto API itself provides them as proto.Int64 , proto.String , and so on. But Go 1.26 makes all these helpers unnecessary: data, err := json.Marshal(&RequestJSON{ URL: url, Attempts: new(10), }) To help you take advantage of this feature, the go fix command now includes a fixer, newexpr , that recognizes “new-like” functions such as newInt and suggests fixes to replace the function body with return new(x) and to replace every call, whether in the same package or an importing package, with a direct use of new(expr) . To avoid introducing premature uses of new features, modernizers offer fixes only in files that require at least the minimum appropriate version of Go (1.26 in this instance), either through a go 1.26 directive in the enclosing go.mod file or a //go:build go1.26 build constraint in the file itself. Run this command to update all calls of this form in your source tree: $ go fix -newexpr ./... At this point, with luck, all of your newInt -like helper functions will have become unused and may be safely deleted (assuming they aren’t part of a stable published API). A few calls may remain where it would be unsafe to suggest a fix, such as when the name new is locally shadowed by another declaration. You can also use the deadcode command to help identify unused functions. Synergistic fixes Applying one modernization may create opportunities to apply another. For example, this snippet of code, which clamps x to the range 0–100, causes the minmax modernizer to suggest a fix to use max . Once that fix is applied it suggests a second fix, this time to use min . x := f() if x < 0 { x = 0 } if x > 100 { x = 100 } x := min(max(f(), 0), 100) Synergies may also occur between different analyzers. For example, a common mistake is to repeatedly concatenate strings within a loop, resulting in quadratic time complexity—a bug and a potential vector for a denial-of-service attack. The stringsbuilder modernizer recognizes the problem and suggests using Go 1.10’s strings.Builder : s := \"\" for _, b := range bytes { s += fmt.Sprintf(\"%02x\", b) } use(s) var s strings.Builder for _, b := range bytes { s.WriteString(fmt.Sprintf(\"%02x\", b)) } use(s.String()) Once this fix is applied, a second analyzer may recognize that the WriteString and Sprintf operations can be combined as fmt.Fprintf(&s, \"%02x\", b) , which is both cleaner and more efficient, and offer a second fix. (This second analyzer is QF1012 from Dominik Honnef’s staticcheck , which is already enabled in gopls but not yet in go fix , though we plan to add staticcheck analyzers to the go command starting in Go 1.27.) Consequently, it may be worth running go fix more than once until it reaches a fixed point; twice is usually enough. Merging fixes and conflicts A single run of go fix may apply dozens of fixes within the same source file. All fixes are conceptually independent, analogous to a set of git commits with the same parent. The go fix command uses a simple three-way merge algorithm to reconcile the fixes in sequence, analogous to the task of merging a set of git commits that edit the same file. If a fix conflicts with the list of edits accumulated so far, it is discarded, and the tool issues a warning that some fixes were skipped and that the tool should be run again. This reliably detects syntactic conflicts arising from overlapping edits, but another class of conflict is possible: a semantic conflict occurs when two changes are textually independent but their meanings are incompatible. As an example consider two fixes that each remove the second-to-last use of a local variable: each fix is fine by itself, but when both are applied together the local variable becomes unused, and in Go that’s a compilation error. Neither fix is responsible for removing the variable declaration, but someone has to do it, and that someone is the user of go fix . A similar semantic conflict arises when a set of fixes causes an import to become unused. Because this case is so common, the go fix command applies a final pass to detect unused imports and remove them automatically. Semantic conflicts are relatively rare. Fortunately they usually reveal themselves as compilation errors, making them impossible to overlook. Unfortunately, when they happen, they do demand some manual work after running go fix . Let’s now delve into the infrastructure beneath these tools. The Go analysis framework Since the earliest days of Go, the go command has had two subcommands for static analysis, go vet and go fix , each with its own suite of algorithms: “checkers” and “fixers”. A checker reports likely mistakes in your code, such as passing a string instead of an integer as the operand of a fmt.Printf(\"%d\") conversion. A fixer safely edits your code to fix a bug or to express the same thing in a better way, perhaps more clearly, concisely, or efficiently. Sometimes the same algorithm appears in both suites when it can both report a mistake and safely fix it. In 2017 we redesigned the then-monolithic go vet program to separate the checker algorithms (now called “analyzers”) from the “driver”, the program that runs them; the result was the Go analysis framework . This separation enables an analyzer to be written once then run in a diverse range of drivers for different environments, such as: unitchecker , which turns a suite of analyzers into a subcommand that can be run by the go command’s scalable incremental build system, analogous to a compiler in go build. This is the basis of go fix and go vet . nogo , the analogous driver for alternative build systems such as Bazel and Blaze. singlechecker , which turns an analyzer into a standalone command that loads, parses, and type-checks a set of packages (perhaps a whole program) and then analyzes them. We often use it for ad hoc experiments and measurements over the module mirror ( proxy.golang.org ) corpus. multichecker , which does the same thing for a suite of analyzers with a ‘swiss-army knife’ CLI. gopls , the language server behind VS Code and other editors, which provides real-time diagnostics from analyzers after each editor keystroke. the highly configurable driver used by the staticcheck tool. (Staticcheck also provides a large suite of analyzers that can be run in other drivers.) Tricorder , the batch static analysis pipeline used by Google’s monorepo and integrated with its code review system. gopls’ MCP server , which makes diagnostics available to LLM-based coding agents, providing more robust “guardrails”. analysistest , the analysis framework’s test harness. One benefit of the framework is its ability to express helper analyzers that don’t report diagnostics or suggest fixes of their own but instead compute some intermediate data structure that may be useful to many other analyzers, amortizing the costs of its construction. Examples include control-flow graphs , the SSA representation of function bodies, and data structures for optimized AST navigation . Another benefit of the framework is its support for making deductions across packages. An analyzer can attach a “ fact ” to a function or other symbol so that information learned while analyzing the function’s body can be used when later analyzing a call to the function, even if the call appears in another package or the later analysis occurs in a different process. This makes it easy to define scalable interprocedural analyses. For example, the printf checker can tell when a function such as log.Printf is really just a wrapper around fmt.Printf , so it knows that calls to log.Printf should be checked in a similar manner. This process works by induction, so the tool will also check calls to further wrappers around log.Printf , and so on. An example of an analyzer that makes heavy use of facts is Uber’s nilaway , which reports potential mistakes resulting in nil pointer dereferences. The process of “separate analysis” in go fix is analogous to the process of separate compilation in go build . Just as the compiler builds packages starting from the bottom of the dependency graph and passing type information up to importing packages, the analysis framework works from the bottom of the dependency graph up, passing facts (and types) up to importing packages. In 2019, as we started developing gopls , the language server for Go, we added the ability for an analyzer to suggest a fix when reporting a diagnostic. The printf analyzer, for example, offers to replace fmt.Printf(msg) with fmt.Printf(\"%s\", msg) to avoid misformatting should the dynamic msg value contain a % symbol. This mechanism has become the basis for many of the quick fixes and refactoring features of gopls. While all these developments were happening to go vet , go fix remained stuck as it was back before the Go compatibility promise , when early adopters of Go used it to maintain their code during the rapid and sometimes incompatible evolution of the language and libraries. The Go 1.26 release brings the Go analysis framework to go fix . The go vet and go fix commands have converged and are now almost identical in implementation. The only differences between them are the criteria for the suites of algorithms they use, and what they do with computed diagnostics. Go vet analyzers must detect likely mistakes with low false positives; their diagnostics are reported to the user. Go fix analyzers must generate fixes that are safe to apply without regression in correctness, performance, or style; their diagnostics may not be reported, but the fixes are directly applied. Aside from this difference of emphasis, the task of developing a fixer is no different from that of developing a checker. Improving analysis infrastructure As the number of analyzers in go vet and go fix continues to grow, we have been investing in infrastructure both to improve the performance of each analyzer and to make it easier to write each new analyzer. For example, most analyzers start by traversing the syntax trees of each file in the package looking for a particular kind of node such as a range statement or function literal. The existing inspector package makes this scan efficient by pre-computing a compact index of a complete traversal so that later traversals can quickly skip subtrees that don’t contain any nodes of interest. Recently we extended it with the Cursor datatype to allow flexible and efficient navigation between nodes in all four cardinal directions—up, down, left, and right, similar to navigating the elements of an HTML DOM—making it easy and efficient to express a query such as “find each go statement that is the first statement of a loop body”: var curFile inspector.Cursor = ... // Find each go statement that is the first statement of a loop body. for curGo := range curFile.Preorder((*ast.GoStmt)(nil)) { kind, index := curGo.ParentEdge() if kind == edge.BlockStmt_List && index == 0 { switch curGo.Parent().ParentEdgeKind() { case edge.ForStmt_Body, edge.RangeStmt_Body: ... } } } Many analyzers start by searching for calls to a specific function, such as fmt.Printf . Function calls are among the most numerous expressions in Go code, so rather than search every call expression and test whether it is a call to fmt.Printf , it is much more efficient to pre-compute an index of symbol references, which is done by typeindex and its helper analyzer. Then the calls to fmt.Printf can be enumerated directly, making the cost proportional to the number of calls instead of to the size of the package. For an analyzer such as hostport that seeks an infrequently used symbol ( net.Dial ), this can easily make it 1,000× faster . Some other infrastructural improvements over the past year include: a dependency graph of the standard library that analyzers can consult to avoid introducing import cycles. For example, we can’t introduce a call to strings.Cut in a package that is itself imported by strings . support for querying the effective Go version of a file as determined by the enclosing go.mod file and build tags, so that analyzers don’t insert uses of features that are “too new”. a richer library of refactoring primitives (e.g. “delete this statement”) that correctly handle adjacent comments and other tricky edge cases. We have come a long way, but there remains much to do. Fixer logic can be tricky to get right. Since we expect users to apply hundreds of suggested fixes with only cursory review, it’s critical that fixers are correct even in obscure edge cases. As just one example (see my GopherCon talk for several more), we built a modernizer that replaces calls such as append([]string{}, slice...) by the clearer slices.Clone(slice) only to discover that, when slice is empty, the result of Clone is nil, a subtle behavior change that in rare cases can cause bugs; so we had to exclude that modernizer from the go fix suite. Some of these difficulties for authors of analyzers can be ameliorated with better documentation (both for humans and LLMs), particularly checklists of surprising edge cases to consider and test. A pattern-matching engine for syntax trees, similar to those in staticcheck and Tree Sitter , could simplify the fiddly task of efficiently identifying the locations that need fixing. A richer library of operators for computing accurate fixes would help avoid common mistakes. A better test harness would let us check that fixes don’t break the build, and preserve dynamic properties of the target code. These are all on our roadmap. The “self-service” paradigm More fundamentally, we are turning our attention in 2026 to a “self-service” paradigm. The newexpr analyzer we saw earlier is a typical modernizer: a bespoke algorithm tailored to a particular feature. The bespoke model works well for features of the language and standard library, but it doesn’t really help update uses of third-party packages. Although there’s nothing to stop you from writing a modernizer for your own public APIs and running it on your own project, there’s no automatic way to get users of your API to run it too. Your modernizer probably wouldn’t belong in gopls or the go vet suite unless your API is particularly widely used across the Go ecosystem. Even in that case you would have to obtain code reviews and approvals and then wait for the next release. Under the self-service paradigm, Go programmers would be able to define modernizations for their own APIs that their users can apply without all the bottlenecks of the current centralized paradigm. This is especially important as the Go community and global Go corpus are growing much faster than the ability of our team to review analyzer contributions. The go fix command in Go 1.26 includes a preview of the first fruits of this new paradigm: the annotation-driven source-level inliner , which is described in a follow-up post . In the coming year, we plan to investigate two more approaches within this paradigm. First, we will be exploring the possibility of dynamically loading modernizers from the source tree and securely executing them, either in gopls or go fix . In this approach a package that provides an API for, say, a SQL database could additionally provide a checker for misuses of the API, such as SQL injection vulnerabilities or failure to handle critical errors. The same mechanism could be used by project maintainers to encode internal housekeeping rules, such as avoiding calls to certain problematic functions or enforcing stronger coding disciplines in critical parts of the code. Second, many existing checkers can be informally described as “don’t forget to X after you Y!”, such as “close the file after you open it”, “cancel the context after you create it”, “unlock the mutex after you lock it”, “break out of the iterator loop after yield returns false”, and so on. What such checkers have in common is that they enforce certain invariants on all execution paths. We plan to explore generalizations and unifications of these control-flow checkers so that Go programmers can easily apply them to new domains, without complex analytical logic, simply by annotating their own code. We hope that these new tools will save you effort during maintenance of your Go projects and help you learn about and benefit from newer features sooner. Please try out go fix on your projects and report any problems you find, and do share any ideas you have for new modernizers, fixers, checkers, or self-service approaches to static analysis.",
+    "quality_score": 8,
+    "modules": [
+      "clean_code",
+      "evolutionary",
+      "go_patterns"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/go1.26",
+    "title": "Go 1.26 is released",
+    "source_name": "The Go Blog",
+    "text": "The Go Blog Today the Go team is pleased to release Go 1.26. You can find its binary archives and installers on the download page . Language changes Go 1.26 introduces two significant refinements to the language syntax and type system . First, the built-in new function, which creates a new variable, now allows its operand to be an expression, specifying the initial value of the variable. A simple example of this change means that code such as this: x := int64(300) ptr := &x Can be simplified to: ptr := new(int64(300)) Second, generic types may now refer to themselves in their own type parameter list. This change simplifies the implementation of complex data structures and interfaces. Performance improvements The previously experimental Green Tea garbage collector is now enabled by default. The baseline cgo overhead has been reduced by approximately 30%. The compiler can now allocate the backing store for slices on the stack in more situations, which improves performance. Tool improvements The go fix command has been completely rewritten to use the Go analysis framework , and now includes a couple dozen “ modernizers ”, analyzers that suggest safe fixes to help your code take advantage of newer features of the language and standard library. It also includes the inline analyzer , which attempts to inline all calls to each function annotated with a //go:fix inline directive. Two upcoming blog posts will address these features in more detail. More improvements and changes Go 1.26 introduces many improvements over Go 1.25 across its tools , the runtime , compiler , linker , and the standard library . This includes the addition of three new packages: crypto/hpke , crypto/mlkem/mlkemtest , and testing/cryptotest . There are port-specific changes and GODEBUG settings updates. Some of the additions in Go 1.26 are in an experimental stage and become exposed only when you explicitly opt in. Notably: An experimental simd/archsimd package provides access to “single instruction, multiple data” (SIMD) operations. An experimental runtime/secret package provides a facility for securely erasing temporaries used in code that manipulates secret information, typically cryptographic in nature. An experimental goroutineleak profile in the runtime/pprof package that reports leaked goroutines. These experiments are all expected to be generally available in a future version of Go. We encourage you to try them out ahead of time. We really value your feedback! Please refer to the Go 1.26 Release Notes for the complete list of additions, changes, and improvements in Go 1.26. Over the next few weeks, follow-up blog posts will cover some of the topics relevant to Go 1.26 in more detail. Check back later to read those posts. Thanks to everyone who contributed to this release by writing code, filing bugs, trying out experimental additions, sharing feedback, and testing the release candidates. Your efforts helped make Go 1.26 as stable as possible. As always, if you notice any problems, please file an issue . We hope you enjoy using the new release!",
+    "quality_score": 8,
+    "modules": [
+      "go_patterns",
+      "dependency_health",
+      "evolutionary"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/survey2025",
+    "title": "Results from the 2025 Go Developer Survey",
+    "source_name": "The Go Blog",
+    "text": "Hello! In this article we’ll discuss the results of the 2025 Go Developer Survey, conducted during September 2025. Thank you to the 5,379 Go developers who responded to our survey invitation this year. Your feedback helps both the Go team at Google and the wider Go community understand the current state of the Go ecosystem and prioritize projects for the year ahead. Our three biggest findings are: Broadly speaking, Go developers asked for help with identifying and applying best practices, making the most of the standard library, and expanding the language and built-in tooling with more modern capabilities. Most Go developers are now using AI-powered development tools when seeking information (e.g., learning how to use a module) or toiling (e.g., writing repetitive blocks of similar code), but their satisfaction with these tools is middling due, in part, to quality concerns. A surprisingly high proportion of respondents said they frequently need to review documentation for core go subcommands, including go build , go run , and go mod , suggesting meaningful room for improvement with the go command’s help system. Read on for the details about these findings, and much more. Sections Who did we hear from? How do people feel about Go? What are people building with Go? What are the biggest challenges facing Go developers? What do their development environments look like? Survey methodology Who did we hear from? Most survey respondents self-identified as professional developers (87%) who use Go for their primary job (82%). A large majority also uses Go for personal or open-source projects (72%). Most respondents were between 25 – 45 years old (68%) with at least six years of professional development experience (75%). Going deeper, 81% of respondents told us they had more professional development experience than Go-specific experience, strong evidence that Go is usually not the first language developers work with. In fact, one of the themes that repeatedly surfaced during this year’s survey analysis seems to stem from this fact: when the way to do a task in Go is substantially different from a more familiar language, it creates friction for developers to first learn the new (to them) idiomatic Go pattern, and then to consistently recall these differences as they continue to work with multiple languages. We’ll return to this theme later. The single most common industry respondents work in was “Technology” (46%), but a majority of respondents work outside of the tech industry (54%). We saw representation of all sizes of organizations, with a bare majority working somewhere with 2 – 500 employees (51%), 9% working alone, and 30% working at enterprises of over 1,000 employees. As in prior years, a majority of responses come from North America and Europe. This year we observed a decrease in the proportion of respondents who said they were fairly new to Go, having worked with it for less than one year (13%, vs. 21% in 2024). We suspect this is related to industry-wide declines in entry-level software engineering roles ; we commonly hear from people that they learned Go for a specific job, so a downturn in hiring would be expected to reduce the number of developers learning Go in that year. This hypothesis is further supported by our finding that over 80% of respondents learned Go after beginning their professional career. Other than the above, we found no significant changes in other demographics since our 2024 survey. How do people feel about Go? The vast majority of respondents (91%) said they felt satisfied while working with Go. Almost ⅔ were “very satisfied”, the highest rating. Both of these metrics are incredibly positive, and have been stable since we began asking this question in 2019. The stability over time is really what we monitor from this metric — we view it as a lagging indicator, meaning by the time this satisfaction metric shows a meaningful change, we would expect to already have seen earlier signals from issue reports, mailing lists, or other community feedback. Why were respondents so positive about Go? Looking at open-text responses to several different survey questions suggests that it’s the gestalt, rather than any one thing. These folks are telling us that they find tremendous value in Go as a holistic platform. That doesn’t mean it supports all programming domains equally well (it surely does not), but that developers’ value the domains it does nicely support via stdlib and built-in tooling. Below are some representative quotations from respondents. To provide context for each quote, we also identify the satisfaction level, years of experience with Go, and industry of the respondent. “Go is by far my favorite language; other languages feel far too complex and unhelpful. The fact that Go is comparatively small, simple, with fewer bells and whistles plays a massive role in making it such a good long-lasting foundation for building programs with it. I love that it scales well to being used by a single programmer and in large teams.” — Very satisfied / 10+ years / Technology company “The entire reason I use Go is the great tooling and standard library. I’m very thankful to the team for focusing on great HTTP, crypto, math, sync, and other tools that make developing service-oriented applications easy and reliable.” — Very satisfied / 10+ years / Energy company “[The] Go ecosystem is the reason why I really like the programming language. There are a lot of npm issues lately but not with Go.” — Very satisfied / 3 – 10 years / Financial services This year we also asked about the other languages that people use. Survey respondents said that besides Go, they enjoy working with Python, Rust, and TypeScript, among a long tail of other languages. Some shared characteristics of these languages align with common points of friction reported by Go developers, including areas like error handling, enums, and object-oriented design patterns. For example, when we sum the proportion of respondents who said their next-favorite language included one of the following factors, we found that majorities of respondents enjoy using languages with inheritance, type-safe enums, and exceptions, with only a bare majority of these languages including a static type system by default. Concept or feature Proportion of respondents Inheritance 71% Type-safe enums 65% Exceptions 60% Static typing 51% We think this is important because it reveals the larger environment in which developers operate — it suggests that people need to use different design patterns for fairly mundane tasks, depending on the language of the codebase they’re currently working on. This leads to additional cognitive load and confusion, not only among developers new to Go (who must learn idiomatic Go design patterns), but also among the many developers who work in multiple codebases or projects. One way to alleviate this additional load is context-specific guidance, such as a tutorial on “Error handling in Go for Java developers”. There may even be opportunities to build some of this guidance into code analyzers, making it easier to surface directly in an IDE. This year we asked the Go community to share their sentiment towards the Go project itself. These results were quite different from the 91% satisfaction rate we discussed above, and point to areas the Go Team plans to invest our energy during 2026. In particular, we want to encourage more contributors to get involved, and ensure the Go Team accurately understands the challenges Go developers currently face. We hope this focus, in turn, will help to increase developer trust in both the Go project and the Go Team leadership. As one respondent explained the problem: “Now that the founding first generation of Go Team members [are] not involved much anymore in the decision making, I am a bit worried about the future of Go in terms of quality of maintenance, and its balanced decisions so far wrt to changes in the language and std lib. More presence in form of talks [by] the new core team members about the current state and future plans might be helpful to strengthen trust.” — Very satisfied / 10+ years / Technology company What are people building with Go? We revised this list of “what types of things do you build with Go?” from 2024 with the intent of more usefully teasing apart what people are building with Go, and avoid confusion around evolving terms like “agents”. Respondent’s top use cases remain CLIs and API services, with no meaningful change in either since 2024. In fact, a majority of respondents (55%) said they build both CLIs and API services with Go. Over ⅓ of respondents specifically build cloud infrastructure tooling (a new category), and 11% work with ML models, tools, or agents (an expanded category). Unfortunately embedded use cases were left off of the revised list, but we’ll fix this for next year’s survey. Most respondents said they are not currently building AI-powered features into the Go software they work on (78%), with ⅔ reporting that their software does not use AI functionality at all (66%). This appears to be a decrease in production-related AI usage year-over-year; in 2024, 59% of respondents were not involved in AI feature work, while 39% indicated some level of involvement. That marks a shift of 14 points away from building AI-powered systems among survey respondents, and may reflect some natural pullback from the early hype around AI-powered applications: it’s plausible that lots of folks tried to see what they could do with this technology during its initial rollout, with some proportion deciding against further exploration (at least at this time). Among respondents who are building AI- or LLM-powered functionality, the most common use case was to create summaries of existing content (45%). Overall, however, there was little difference between most uses, with between 28% – 33% of respondents adding AI functionality to support classification, generation, solution identification, chatbots, and software development. What are the biggest challenges facing Go developers? One of the most helpful types of feedback we receive from developers are details about the challenges people run into while working with Go. The Go Team considers this information holistically and over long time horizons, because there is often tension between improving Go’s rougher edges and keeping the language and tooling consistent for developers. Beyond technical factors, every change also incurs some cost in terms of developer attention and cognitive disruption. Minimizing disruption may sound a bit dull or boring, but we view this as an important strength of Go. As Russ Cox wrote in 2023, “Boring is good… Boring means being able to focus on your work, not on what’s different about Go.” . In that spirit, this year’s top challenges are not radically different from last year’s. The top three frustrations respondents reported were “Ensuring our Go code follows best practices / Go idioms” (33% of respondents), “A feature I value from another language isn’t part of Go” (28%), and “Finding trustworthy Go modules and packages” (26%). We examined open-text responses to better understand what people meant. Let’s take a minute to dig into each. Respondents who were most frustrated by writing idiomatic Go were often looking for more official guidance, as well as tooling support to help enforce this guidance in their codebase. As in prior surveys, questions about how to structure Go projects were also a common theme. For example: “The simplicity of go helps to read and understand code from other developers, but there are still some aspects that can differ quite a lot between programmers. Especially if developers come from other languages, e.g. Java.” — Very satisfied / 3 – 10 years / Healthcare and life sciences “More opinionated way to write go code. Like how to structure a Go project for services/cli tool.” — Very satisfied / < 3 years / Technology “It’s hard to figure out what are good idioms. Especially since the core team doesn’t keep Effective Go up-to-date.” — Very satisfied / 3 – 10 years / Technology The second major category of frustrations were language features that developers enjoyed working with in other ecosystems. These open-text comments largely focused on error handling and reporting patterns, enums and sum types, nil pointer safety, and general expressivity / verbosity: “Still not sure what is the best way to do error handling.” — Very satisfied / 3 – 10 years / Retail and consumer goods “Rust’s enums are great, and lead to writing great type safe code.” — Somewhat satisfied / 3 – 10 years / Healthcare and life sciences “There is nothing (in the compiler) that stops me from using a maybe nil pointer, or using a value without checking the err first. That should be [baked into] the type system.” — Somewhat satisfied / < 3 years / Technology “I like [Go] but I didn’t expect it to have nil pointer exceptions :)” — Somewhat satisfied / 3 – 10 years / Financial services “I often find it hard to build abstractions and to provide clear intention to the future readers of my code.” — Somewhat dissatisfied / < 3 years / Technology The third major frustration was finding trustworthy Go modules. Respondents often described two aspects to this problem. One is that they considered many 3rd-party modules to be of marginal quality, making it hard for really good modules to stand out. The second is identifying which modules are commonly used and under which types of conditions (including recent trends over time). These are both problems that could be addressed by showing what we’ll vaguely call “quality signals” on pkg.go.dev. Respondents provided helpful explanations of the signals they use to identify trustworthy modules, including project activity, code quality, recent adoption trends, or the specific organizations that support or rely upon the module. “Being able to filter by criteria like stable version, number of users and last update age at pkg.go.dev could make things a bit easier.” — Very satisfied / < 3 years / Technology “Many pacakges are just clones/forks or one-off pojects with no history/maintenance. [sic]” — Very satisfied / 10+ years / Financial services “Maybe flagging trustworthy packages based on experience, maturity and community feedback?” — Very satisfied / 3 – 10 years / Healthcare and life sciences We agree that these are all areas where the developer experience with Go could be improved. The challenge, as discussed earlier, is doing so in such a way that doesn’t lead to breaking changes, increased confusion among Go developers, or otherwise gets in the way of people trying to get their work done with Go. Feedback from this survey is a major source of information we use when discussing proposals, but if you’d like to get involved more directly or follow along with other contributors, visit the Go proposals on GitHub ; please be sure to follow this process if you’d like to add a new proposal. In addition to these (potentially) ecosystem-wide challenges, this year we also asked specifically about working with the go command. We’ve informally heard from developers that this tool’s help system can be confusing to navigate, but we haven’t had a great sense of how frequently people find themselves reviewing this documentation. Respondents told us that except for go test , between 15% – 25% of them felt they “often needed to review documentation” with working with these tools. This was surprising, especially for commonly-used subcommands like build and run . Common reasons included remembering specific flags, understanding what different options do, and navigating the help system itself. Participants also confirmed that infrequent use was one reason for frustration, but navigating and parsing command help appears to be the underlying cause. In other words, we all expect to need to review documentation sometimes, but we don’t expect to need help navigating the documentation system itself. As on respondent described their journey: “Accessing the help is painful. go test –help # didn’t work, but tell[s] me to type go help test instead… go help test # oh, actually, the info I’m looking for is in testflag go help testflag # visually parsing through text that looks all the same without much formatting… I just lack time to dig into this rabbit hole.” — Very satisfied / 10+ years / Technology What does their development environment look like? Operating systems and architectures Generally, respondents told us their development platforms are UNIX-like. Most respondents develop on macOS (60%) or Linux (58%) and deploy to Linux-based systems, including containers (96%). The largest year-over-year change was among “embedded devices / IoT” deployments, which increased from 2% -> 8% of respondents; this was the only meaningful change in deployment platforms since 2024. The vast majority of respondents develop on x86-64 or ARM64 architectures, with a sizable group (25%) still potentially working on 32-bit x86 systems. However, we believe the wording of this question was confusing to respondents; next year we’ll clarify the 32-bit vs. 64-bit distinction for each architecture. Code editors Several new code editors have become available in the past two years, and we expanded our survey question to include the most popular ones. While we saw some evidence of early adoption, most respondents continued to favor VS Code (37%) or GoLand (28%). Of the newer editors, Zed and Cursor were the highest ranked, each becoming the preferred editor of 4% of respondents. To put those numbers in context, we looked back at when VS Code and GoLand were first introduced. VS Code (released in 2015) was favored by 16% of respondents one year after its release. IntelliJ has had a community-led Go plugin longer than we’ve been surveying Go developers (💙), but if we look at when JetBrains began officially supporting Go in IntelliJ (2016), within one year IntelliJ was preferred by 20% of respondents. Note: This analysis of code editors does not include respondents who were referred to the survey directly from VS Code or GoLand. Cloud environments The most common deployment environments for Go continue to be Amazon Web Services (AWS) at 46% of respondents, company-owned servers (44%), and Google Cloud Platform (GCP) at 26%. These numbers show minor shifts since 2024, but nothing statistically significant. We found that the “Other” category increased to 11% this year, and this was primarily driven by Hetzner (20% of Other responses); we plan to include Hetzner as a response choice in next year’s survey. We also asked respondents about their development experience of working with different cloud providers. The most common responses, however, showed that respondents weren’t really sure (46%) or don’t directly interact with public cloud providers (21%). The biggest driver behind these responses was a theme we’ve heard often before: with containers, it’s possible to abstract many details of the cloud environment away from the developer, so that they don’t meaningfully interact with most provider-specific technologies. This result suggests that even developers whose work is deployed to clouds may have limited experience with the larger suite of tools and technology associated with each cloud provider. For example: “Kinda abstract to the platform, Go is very easy to put in a container and so pretty easy to deploy anywhere: one of its big strength[s].” — [no satisfaction response] / 3 – 10 years / Technology “The cloud provider really doesn’t make much difference to me. I write code and deploy it to containers, so whether that’s AWS or GCP I don’t really care.” — Somewhat satisfied / 3 – 10 years / Financial services We suspect this level of abstraction is dependant on the use case and requirements of the service that’s being deployed — it may not always make sense or be possible to keep it highly abstracted. In the future, we plan to further investigate how Go developers tend to interact with the platforms where their software is ultimately deployed. Developing with AI Finally, we can’t discuss development environments in 2025 without also mentioning AI-powered software development tools. Our survey suggests bifurcated adoption — while a majority of respondents (53%) said they use such tools daily, there is also a large group (29%) who do not use these at all, or only used them a few times during the past month. We expected this to negatively correlate with age or development experience, but were unable to find strong evidence supporting this theory except for very new developers: respondents with less than one year of professional development experience (not specific to Go) did report more AI use than every other cohort, but this group only represented 2% of survey respondents. At this time, agentic use of AI-powered tools appears nascent among Go developers, with only 17% of respondents saying this is their primary way of using such tools, though a larger group (40%) are occasionally trying agentic modes of operation. The most commonly used AI assistants remain ChatGPT, GitHub Copilot, and Claude. Most of these agents show lower usage numbers compared with our 2024 survey (Claude and Cursor are notable exceptions), but due to a methodology change, this is not an apples-to-apples comparison. It is, however, plausible that developers are “shopping around” less than they were when these tools were first released, resulting in more people using a single assistant for most of their work. We also asked about overall satisfaction with AI-powered development tools. A majority (55%) reported being satisfied, but this was heavily weighted towards the “Somewhat satisfied” category (42%) vs. the “Very satisfied” group (13%). Recall that Go itself consistently shows a 90%+ satisfaction rate each year; this year, 62% of respondents said they are “Very satisfied” with Go. We add this context to show that while AI-powered tooling is starting to see adoption and finding some successful use cases, developer sentiment towards them remains much softer than towards more established tooling (among Go developers, at least). What is driving this lower rate of satisfaction? In a word: quality. We asked respondents to tell us something good they’ve accomplished with these tools, as well as something that didn’t work out well. A majority said that creating non-functional code was their primary problem with AI developer tools (53%), with 30% lamenting that even working code was of poor quality. The most frequently cited benefits, conversely, were generating unit tests, writing boilerplate code, enhanced autocompletion, refactoring, and documentation generation. These appear to be cases where code quality is perceived as less critical, tipping the balance in favor of letting AI take the first pass at a task. That said, respondents also told us the AI-generated code in these successful cases still required careful review (and often, corrections), as it can be buggy, insecure, or lack context. “I’m never satisfied with code quality or consistency, it never follows the practices I want to.” — [no satisfaction response] / 3 – 10 years / Financial services “All AI tools tend to hallucinate quickly when working with medium-to-large codebases (10k+ lines of code). They can explain code effectively but struggle to generate new, complex features” — Somewhat satisfied / 3 – 10 years / Retail and consumer goods “Despite numerous efforts to make it write code in an established codebase, it would take too much effort to steer it to follow the practices in the project, and it would add subtle behaviour paths - i.e. if it would miss some method it would try to find its way around it or rely on some side effect. Sometimes those things are hard to recognize during code review. I also found it mentally taxing to review ai generated code and that overhead kills the productivity potential in writing code.” — Very satisfied / 10+ years / Technology When we asked developers what they used these tools for, a pattern emerged that is consistent with these quality concerns. The tasks with most adoption (green in the chart below) and least resistance (red) deal with bridging knowledge gaps, improving local code, and avoiding toil. The frustrations that developers talk about with code-generating tools were much less evident when they’re seeking information, like how to use a specific API or configure test coverage, and perhaps as a result, we see higher usage of AI in these areas. Another spot that stood out was local code review and related suggestions — people were less interested in using AI to review other people’s code than in reviewing their own. Surprisingly, “testing code” showed lower AI adoption than other toilsome tasks, though we don’t yet have strong understanding of why. Of all the tasks we asked about, “Writing code” was the most bifurcated, with 66% of respondents already or hoping to soon use AI for this, while ¼ of respondents didn’t want AI involved at all. Open-ended responses suggest developers primarily use this for toilsome, repetitive code, and continue to have concerns about the quality of AI-generated code. Closing Once again, a tremendous thank-you to everyone who responded to this year’s Go Developer Survey! We plan to share the raw survey dataset in Q1 2026, so the larger community can also explore the data underlying these findings. This will only include responses from people who opted in to share this data (82% of all respondents), so there may be some differences from the numbers we reference in this post. Survey methodology This survey was conducted between Sept 9 - Sept 30, 2025. Participants were publicly invited to respond via the Go Blog, invitations on social media channels (including Bluesky, Mastodon, Reddit, and X), as well as randomized in-product invitations to people using VS Code and GoLand to write Go software. We received a total of 7,070 responses. After data cleaning to remove bots and other very low quality responses, 5,379 were used for the remainder of our analysis. The median survey response time was between 12 – 13 minutes. Throughout this report we use charts of survey responses to provide supporting evidence for our findings. All of these charts use a similar format. The title is the exact question that survey respondents saw. Unless otherwise noted, questions were multiple choice and participants could only select a single response choice; each chart’s subtitle will tell the reader if the question allowed multiple response choices or was an open-ended text box instead of a multiple choice question. For charts of open-ended text responses, a Go team member read and manually categorized all of the responses. Many open-ended questions elicited a wide variety of responses; to keep the chart sizes reasonable, we condensed them to a maximum of the top 10-12 themes, with additional themes all grouped under “Other”. The percentage labels shown in charts are rounded to the nearest integer (e.g., 1.4% and 0.8% will both be displayed as 1%), but the length of each bar and row ordering are based on the unrounded values. To help readers understand the weight of evidence underlying each finding, we included error bars showing the 95% confidence interval for responses; narrower bars indicate increased confidence. Sometimes two or more responses have overlapping error bars, which means the relative order of those responses is not statistically meaningful (i.e., the responses are effectively tied). The lower right of each chart shows the number of people whose responses are included in the chart, in the form “n = [number of respondents]”.",
+    "quality_score": 7,
+    "modules": [
+      "dx",
+      "evolutionary",
+      "go_patterns"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/greenteagc",
+    "title": "The Green Tea Garbage Collector",
+    "source_name": "The Go Blog",
+    "text": "Go 1.25 includes a new experimental garbage collector called Green Tea, available by setting GOEXPERIMENT=greenteagc at build time. Many workloads spend around 10% less time in the garbage collector, but some workloads see a reduction of up to 40%! It’s production-ready and already in use at Google, so we encourage you to try it out. We know some workloads don’t benefit as much, or even at all, so your feedback is crucial to helping us move forward. Based on the data we have now, we plan to make it the default in Go 1.26. To report back with any problems, file a new issue . To report back with any successes, reply to the existing Green Tea issue . What follows is a blog post based on Michael Knyszek’s GopherCon 2025 talk. Tracing garbage collection Before we discuss Green Tea let’s get us all on the same page about garbage collection. Objects and pointers The purpose of garbage collection is to automatically reclaim and reuse memory no longer used by the program. To this end, the Go garbage collector concerns itself with objects and pointers . In the context of the Go runtime, objects are Go values whose underlying memory is allocated from the heap. Heap objects are created when the Go compiler can’t figure out how else to allocate memory for a value. For example, the following code snippet allocates a single heap object: the backing store for a slice of pointers. var x = make([]*int, 10) // global The Go compiler can’t allocate the slice backing store anywhere except the heap, since it’s very hard, and maybe even impossible, for it to know how long x will refer to the object for. Pointers are just numbers that indicate the location of a Go value in memory, and they’re how a Go program references objects. For example, to get the pointer to the beginning of the object allocated in the last code snippet, we can write: &x[0] // 0xc000104000 The mark-sweep algorithm Go’s garbage collector follows a strategy broadly referred to as tracing garbage collection , which just means that the garbage collector follows, or traces, the pointers in the program to identify which objects the program is still using. More specifically, the Go garbage collector implements the mark-sweep algorithm. This is much simpler than it sounds. Imagine objects and pointers as a sort of graph, in the computer science sense. Objects are nodes, pointers are edges. The mark-sweep algorithm operates on this graph, and as the name might suggest, proceeds in two phases. In the first phase, the mark phase, it walks the object graph from well-defined source edges called roots . Think global and local variables. Then, it marks everything it finds along the way as visited , to avoid going in circles. This is analogous to your typical graph flood algorithm, like a depth-first or breadth-first search. Next is the sweep phase. Whatever objects were not visited in our graph walk are unused, or unreachable , by the program. We call this state unreachable because it is impossible with normal safe Go code to access that memory anymore, simply through the semantics of the language. To complete the sweep phase, the algorithm simply iterates through all the unvisited nodes and marks their memory as free, so the memory allocator can reuse it. That’s it? You may think I’m oversimplifying a bit here. Garbage collectors are frequently referred to as magic , and black boxes . And you’d be partially right, there are more complexities. For example, this algorithm is, in practice, executed concurrently with your regular Go code. Walking a graph that’s mutating underneath you brings challenges. We also parallelize this algorithm, which is a detail that’ll come up again later. But trust me when I tell you that these details are mostly separate from the core algorithm. It really is just a simple graph flood at the center. Graph flood example Let’s walk through an example. Navigate through the slideshow below to follow along. Here we have a diagram of some global variables and Go heap. Let's break it down, piece by piece. On the left here we have our roots. These are global variables x and y. They will be the starting point of our graph walk. Since they're marked blue, according to our handy legend in the bottom left, they're currently on our work list. On the right side, we have our heap. Currently, everything in our heap is grayed out because we haven't visited any of it yet. Each one of these rectangles represents an object. Each object is labeled with its type. This object in particular is an object of type T, whose type definition is on the top left. It's got a pointer to an array of children, and some value. We can surmise that this is some kind of recursive tree data structure. In addition to the objects of type T, you'll also notice that we have array objects containing *Ts. These are pointed to by the \"children\" field of objects of type T. Each square inside of the rectangle represents 8 bytes of memory. A square with a dot is a pointer. If it has an arrow, it is a non-nil pointer pointing to some other object. And if it doesn't have a corresponding arrow, then it's a nil pointer. Next, these dotted rectangles represents free space, what I'll call a free \"slot.\" We could put an object there, but there currently isn't one. You'll also notice that objects are grouped together by these labeled, dotted rounded rectangles. Each of these represents a page , which is a contiguous block of fixed-size, aligned memory. In Go, pages are 8 KiB (regardless of the hardware virtual memory page size). These pages are labeled A, B, C, and D, and I'll refer to them that way. In this diagram, each object is allocated as part of some page. Like in the real implementation, each page here only contains objects of a certain size. This is just how the Go heap is organized. Pages are also how we organize per-object metadata. Here you can see seven boxes, each corresponding to one of the seven object slots in page A. Each box represents one bit of information: whether or not we have seen the object before. This is actually how the real runtime manages whether an object has been visited, and it'll be an important detail later. That was a lot of detail, so thanks for reading along. This will all come into play later. For now, let's just see how our graph flood applies to this picture. We start by taking a root off of the work list. We mark it red to indicate that it's now active. Following that root's pointer, we find an object of type T, which we add to our work list. Following our legend, we draw the object in blue to indicate that it's on our work list. Note also that we set the seen bit corresponding to this object in our metadata. Same goes for the next root. Now that we've taken care of all the roots, we're left with two objects on our work list. Let's take an object off the work list. What we're going to do now is walk the pointers of the objects, to find more objects. By the way, we call walking the pointers of an object \"scanning\" the object. We find this valid array object… … and add it to our work list. From here, we proceed recursively. We walk the array's pointers. Find some more objects… Then we walk the objects that the array object referred to! And note that we still have to walk over all pointers, even if they're nil. We don't know ahead of time if they will be. One more object down this branch… And now we've reached the other branch, starting from that object in page A we found much earlier from one of the roots. You may be noticing a last-in-first-out discipline for our work list here, indicating that our work list is a stack, and hence our graph flood is approximately depth-first. This is intentional, and reflects the actual graph flood algorithm in the Go runtime. Let's keep going… Next we find another array object… And walk it… Just one more object left on our work list… Let's scan it… And we're done with the mark phase! There's nothing we're actively working on and there's nothing left on our work list. Every object drawn in black is reachable, and every object drawn in gray is unreachable. Let's sweep the unreachable objects, all in one go. We've converted those objects into free slots, ready to hold new objects. The problem After all that, I think we have a handle on what the Go garbage collector is actually doing. This process seems to work well enough today, so what’s the problem? Well, it turns out we can spend a lot of time executing this particular algorithm in some programs, and it adds substantial overhead to nearly every Go program. It’s not that uncommon to see Go programs spending 20% or more of their CPU time in the garbage collector. Let’s break down where that time is being spent. Garbage collection costs At a high level, there are two parts to the cost of the garbage collector. The first is how often it runs, and the second is how much work it does each time it runs. Multiply those two together, and you get the total cost of the garbage collector. Total GC cost = Number of GC cycles × Average cost per GC cycle Over the years we’ve tackled both terms in this equation, and for more on how often the garbage collector runs, see Michael’s GopherCon EU talk from 2022 about memory limits. The guide to the Go garbage collector also has a lot to say about this topic, and is worth a look if you want to dive deeper. But for now let’s focus only on the second part, the cost per cycle. From years of poring over CPU profiles to try to improve performance, we know two big things about Go’s garbage collector. The first is that about 90% of the cost of the garbage collector is spent marking, and only about 10% is sweeping. Sweeping turns out to be much easier to optimize than marking, and Go has had a very efficient sweeper for many years. The second is that, of that time spent marking, a substantial portion, usually at least 35%, is simply spent stalled on accessing heap memory. This is bad enough on its own, but it completely gums up the works on what makes modern CPUs actually fast. “A microarchitectural disaster” What does “gum up the works” mean in this context? The specifics of modern CPUs can get pretty complicated, so let’s use an analogy. Imagine the CPU driving down a road, where that road is your program. The CPU wants to ramp up to a high speed, and to do that it needs to be able to see far ahead of it, and the way needs to be clear. But the graph flood algorithm is like driving through city streets for the CPU. The CPU can’t see around corners and it can’t predict what’s going to happen next. To make progress, it constantly has to slow down to make turns, stop at traffic lights, and avoid pedestrians. It hardly matters how fast your engine is because you never get a chance to get going. Let’s make that more concrete by looking at our example again. I’ve overlaid the heap here with the path that we took. Each left-to-right arrow represents a piece of scanning work that we did and the dashed arrows show how we jumped around between bits of scanning work. The path through the heap the garbage collector took in our graph flood example. Notice that we were jumping all over memory doing tiny bits of work in each place. In particular, we’re frequently jumping between pages, and between different parts of pages. Modern CPUs do a lot of caching. Going to main memory can be up to 100x slower than accessing memory that’s in our cache. CPU caches are populated with memory that’s been recently accessed, and memory that’s nearby to recently accessed memory. But there’s no guarantee that any two objects that point to each other will also be close to each other in memory. The graph flood doesn’t take this into account. Quick side note: if we were just stalling fetches to main memory, it might not be so bad. CPUs issue memory requests asynchronously, so even slow ones could overlap if the CPU could see far enough ahead. But in the graph flood, every bit of work is small, unpredictable, and highly dependent on the last, so the CPU is forced to wait on nearly every individual memory fetch. And unfortunately for us, this problem is only getting worse. There’s an adage in the industry of “wait two years and your code will get faster.” But Go, as a garbage collected language that relies on the mark-sweep algorithm, risks the opposite. “Wait two years and your code will get slower.” The trends in modern CPU hardware are creating new challenges for garbage collector performance: Non-uniform memory access. For one, memory now tends to be associated with subsets of CPU cores. Accesses by other CPU cores to that memory are slower than before. In other words, the cost of a main memory access depends on which CPU core is accessing it . It’s non-uniform, so we call this non-uniform memory access, or NUMA for short. Reduced memory bandwidth. Available memory bandwidth per CPU is trending downward over time. This just means that while we have more CPU cores, each core can submit relatively fewer requests to main memory, forcing non-cached requests to wait longer than before. Ever more CPU cores. Above, we looked at a sequential marking algorithm, but the real garbage collector performs this algorithm in parallel. This scales well to a limited number of CPU cores, but the shared queue of objects to scan becomes a bottleneck, even with careful design. Modern hardware features. New hardware has fancy features like vector instructions, which let us operate on a lot of data at once. While this has the potential for big speedups, it’s not immediately clear how to make that work for marking because marking does so much irregular and often small pieces of work. Green Tea Finally, this brings us to Green Tea, our new approach to the mark-sweep algorithm. The key idea behind Green Tea is astonishingly simple: Work with pages, not objects. Sounds trivial, right? And yet, it took a lot of work to figure out how to order the object graph walk and what we needed to track to make this work well in practice. More concretely, this means: Instead of scanning objects we scan whole pages. Instead of tracking objects on our work list, we track whole pages. We still need to mark objects at the end of the day, but we’ll track marked objects locally to each page, rather than across the whole heap. Green Tea example Let’s see what this means in practice by looking at our example heap again, but this time running Green Tea instead of the straightforward graph flood. As above, navigate through the annotated slideshow to follow along. This is the same heap as before, but now with two bits of metadata per object rather than one. Again, each bit, or box, corresponds to one of the object slots in the page. In total, we now have fourteen bits that correspond to the seven slots in page A. The top bits represent the same thing as before: whether or not we've seen a pointer to the object. I'll call these the \"seen\" bits. The bottom set of bits are new. These \"scanned\" bits track whether or not we've scanned the object. This new piece of metadata is necessary because, in Green tea, the work list tracks pages, not objects . We still need to track objects at some level, and that's the purpose of these bits. We start off the same as before, walking objects from the roots. But this time, instead of putting an object on the work list, we put a whole page–in this case page A–on the work list, indicated by shading the whole page blue. The object we found is also blue to indicate that when we do take this page off of the work list, we will need to look at that object. Note that the object's blue hue directly reflects the metadata in page A. Its corresponding seen bit is set, but its scanned bit is not. We follow the next root, find another object, and again put the whole page–page C–on the work list and set the object's seen bit. We're done following roots, so we turn to the work list and take page A off the work list. Using the seen and scanned bits, we can tell there's one object to scan on page A. We scan that object, following its pointers. And as a result, we add page B to the work list, since the first object in page A points to an object in page B. We're done with page A. Next we take page C off the work list. Similar to page A, there's a single object on page C to scan. We found a pointer to another object in page B. Page B is already on the work list, so we don't need to add anything to the work list. We simply have to set the seen bit for the target object. Now it's page B's turn. We've accumulated two objects to scan on page B, and we can process both of these objects in a row, in memory order! We walk the pointers of the first object… We find a pointer to an object in page A. Page A was previously on the work list, but isn't at this point, so we put it back on the work list. Unlike the original mark-sweep algorithm, where any given object is only added to the work list at most once per whole mark phase, in Green Tea, a given page can reappear on the work list several times during a mark phase. We scan the second seen object in the page immediately after the first. We find a few more objects in page A… We're done scanning page B, so we pull page A off the work list. This time we only need to scan three objects, not four, since we already scanned the first object. We know which objects to scan by looking at the difference between the \"seen\" and \"scanned\" bits. We'll scan these objects in sequence. We're done! There are no more pages on the work list and there's nothing we're actively looking at. Notice that the metadata now all lines up nicely, since all reachable objects were both seen and scanned. You may have also noticed during our traversal that the work list order is a little different from the graph flood. Where the graph flood had a last-in-first-out, or stack-like, order, here we're using a first-in-first-out, or queue-like, order for the pages on our work list. This is intentional. We let seen objects accumulate on each page while the page sits on the queue, so we can process as many as we can at once. That's how we were able to hit so many objects on page A at once. Sometimes laziness is a virtue. And finally we can sweep away the unvisited objects, as before. Getting on the highway Let’s come back around to our driving analogy. Are we finally getting on the highway? Let’s recall our graph flood picture before. The path the original graph flood took through the heap required 7 separate scans. We jumped around a whole lot, doing little bits of work in different places. The path taken by Green Tea looks very different. The path taken by Green Tea requires only 4 scans. Green Tea, in contrast, makes fewer, longer left-to-right passes over pages A and B. The longer these arrows, the better, and with bigger heaps, this effect can be much stronger. That’s the magic of Green Tea. It’s also our opportunity to ride the highway. This all adds up to a better fit with the microarchitecture. We can now scan objects closer together with much higher probability, so there’s a better chance we can make use of our caches and avoid main memory. Likewise, per-page metadata is more likely to be in cache. Tracking pages instead of objects means work lists are smaller, and less pressure on work lists means less contention and fewer CPU stalls. And speaking of the highway, we can take our metaphorical engine into gears we’ve never been able to before, since now we can use vector hardware! Vector acceleration If you’re only vaguely familiar with vector hardware, you might be confused as to how we can use it here. But besides the usual arithmetic and trigonometric operations, recent vector hardware supports two things that are valuable for Green Tea: very wide registers, and sophisticated bit-wise operations. Most modern x86 CPUs support AVX-512, which has 512-bit wide vector registers. This is wide enough to hold all of the metadata for an entire page in just two registers, right on the CPU, enabling Green Tea to work on an entire page in just a few straight-line instructions. Vector hardware has long supported basic bit-wise operations on whole vector registers, but starting with AMD Zen 4 and Intel Ice Lake, it also supports a new bit vector “Swiss army knife” instruction that enables a key step of the Green Tea scanning process to be done in just a few CPU cycles. Together, these allow us to turbo-charge the Green Tea scan loop. This wasn’t even an option for the graph flood, where we’d be jumping between scanning objects that are all sorts of different sizes. Sometimes you needed two bits of metadata and sometimes you needed ten thousand. There simply wasn’t enough predictability or regularity to use vector hardware. If you want to nerd out on some of the details, read along! Otherwise, feel free to skip ahead to the evaluation . AVX-512 scanning kernel To get a sense of what AVX-512 GC scanning looks like, take a look at the diagram below. The AVX-512 vector kernel for scanning. There’s a lot going on here and we could probably fill an entire blog post just on how this works. For now, let’s just break it down at a high level: First we fetch the “seen” and “scanned” bits for a page. Recall, these are one bit per object in the page, and all objects in a page have the same size. Next, we compare the two bit sets. Their union becomes the new “scanned” bits, while their difference is the “active objects” bitmap, which tells us which objects we need to scan in this pass over the page (versus previous passes). We take the difference of the bitmaps and “expand” it, so that instead of one bit per object, we have one bit per word (8 bytes) of the page. We call this the “active words” bitmap. For example, if the page stores 6-word (48-byte) objects, each bit in the active objects bitmap will be copied to 6 bits in the active words bitmap. Like so: 0 0 1 1 ... → 000000 000000 111111 111111 ... Next we fetch the pointer/scalar bitmap for the page. Here, too, each bit corresponds to a word (8 bytes) of the page, and it tells us whether that word stores a pointer. This data is managed by the memory allocator. Now, we take the intersection of the pointer/scalar bitmap and the active words bitmap. The result is the “active pointer bitmap”: a bitmap that tells us the location of every pointer in the entire page contained in any live object we haven’t scanned yet. Finally, we can iterate over the memory of the page and collect all the pointers. Logically, we iterate over each set bit in the active pointer bitmap, load the pointer value at that word, and write it back to a buffer that will later be used to mark objects seen and add pages to the work list. Using vector instructions, we’re able to do this 64 bytes at a time, in just a couple instructions. Part of what makes this fast is the VGF2P8AFFINEQB instruction, part of the “Galois Field New Instructions” x86 extension, and the bit manipulation Swiss army knife we referred to above. It’s the real star of the show, since it lets us do step (3) in the scanning kernel very, very efficiently. It performs a bit-wise affine transformations , treating each byte in a vector as itself a mathematical vector of 8 bits and multiplying it by an 8x8 bit matrix. This is all done over the Galois field GF(2) , which just means multiplication is AND and addition is XOR. The upshot of this is that we can define a few 8x8 bit matrices for each object size that perform exactly the 1:n bit expansion we need. For the full assembly code, see this file . The “expanders” use different matrices and different permutations for each size class, so they’re in a separate file that’s written by a code generator . Aside from the expansion functions, it’s really not a lot of code. Most of it is dramatically simplified by the fact that we can perform most of the above operations on data that sits purely in registers. And, hopefully soon this assembly code will be replaced with Go code ! Credit to Austin Clements for devising this process. It’s incredibly cool, and incredibly fast! Evaluation So that’s it for how it works. How much does it actually help? It can be quite a lot. Even without the vector enhancements, we see reductions in garbage collection CPU costs between 10% and 40% in our benchmark suite. For example, if an application spends 10% of its time in the garbage collector, then that would translate to between a 1% and 4% overall CPU reduction, depending on the specifics of the workload. A 10% reduction in garbage collection CPU time is roughly the modal improvement. (See the GitHub issue for some of these details.) We’ve rolled Green Tea out inside Google, and we see similar results at scale. We’re still rolling out the vector enhancements, but benchmarks and early results suggest this will net an additional 10% GC CPU reduction. While most workloads benefit to some degree, there are some that don’t. Green Tea is based on the hypothesis that we can accumulate enough objects to scan on a single page in one pass to counteract the costs of the accumulation process. This is clearly the case if the heap has a very regular structure: objects of the same size at a similar depth in the object graph. But there are some workloads that often require us to scan only a single object per page at a time. This is potentially worse than the graph flood because we might be doing more work than before while trying to accumulate objects on pages and failing. The implementation of Green Tea has a special case for pages that have only a single object to scan. This helps reduce regressions, but doesn’t completely eliminate them. However, it takes a lot less per-page accumulation to outperform the graph flood than you might expect. One surprise result of this work was that scanning a mere 2% of a page at a time can yield improvements over the graph flood. Availability Green Tea is already available as an experiment in the recent Go 1.25 release and can be enabled by setting the environment variable GOEXPERIMENT to greenteagc at build time. This doesn’t include the aforementioned vector acceleration. We expect to make it the default garbage collector in Go 1.26, but you’ll still be able to opt-out with GOEXPERIMENT=nogreenteagc at build time. Go 1.26 will also add vector acceleration on newer x86 hardware, and include a whole bunch of tweaks and improvements based on feedback we’ve collected so far. If you can, we encourage you to try at Go tip-of-tree! If you prefer to use Go 1.25, we’d still love your feedback. See this GitHub comment with some details on what diagnostics we’d be interested in seeing, if you can share, and the preferred channels for reporting feedback. The journey Before we wrap up this blog post, let’s take a moment to talk about the journey that got us here. The human element of the technology. The core of Green Tea may seem like a single, simple idea. Like the spark of inspiration that just one single person had. But that’s not true at all. Green Tea is the result of work and ideas from many people over several years. Several people on the Go team contributed to the ideas, including Michael Pratt, Cherry Mui, David Chase, and Keith Randall. Microarchitectural insights from Yves Vandriessche, who was at Intel at the time, also really helped direct the design exploration. There were a lot of ideas that didn’t work, and there were a lot of details that needed figuring out. Just to make this single, simple idea viable. A timeline depicting a subset of the ideas we tried in this vein before getting to where we are today. The seeds of this idea go all the way back to 2018. What’s funny is that everyone on the team thinks someone else thought of this initial idea. Green Tea got its name in 2024 when Austin worked out a prototype of an earlier version while cafe crawling in Japan and drinking LOTS of matcha! This prototype showed that the core idea of Green Tea was viable. And from there we were off to the races. Throughout 2025, as Michael implemented and productionized Green Tea, the ideas evolved and changed even further. This took so much collaborative exploration because Green Tea is not just an algorithm, but an entire design space. One that we don’t think any of us could’ve navigated alone. It’s not enough to just have the idea, but you need to figure out the details and prove it. And now that we’ve done it, we can finally iterate. The future of Green Tea is bright. Once again, please try it out by setting GOEXPERIMENT=greenteagc and let us know how it goes! We’re really excited about this work and want to hear from you!",
+    "quality_score": 9,
+    "modules": [
+      "performance",
+      "concurrency",
+      "go_patterns"
+    ]
+  },
+  {
+    "url": "https://go.dev/blog/flight-recorder",
+    "title": "Flight Recorder in Go 1.25",
+    "source_name": "The Go Blog",
+    "text": "In 2024 we introduced the world to more powerful Go execution traces . In that blog post we gave a sneak peek into some of the new functionality we could unlock with our new execution tracer, including flight recording . We’re happy to announce that flight recording is now available in Go 1.25, and it’s a powerful new tool in the Go diagnostics toolbox. Execution traces First, a quick recap on Go execution traces. The Go runtime can be made to write a log recording many of the events that happen during the execution of a Go application. That log is called a runtime execution trace. Go execution traces contain a plethora of information about how goroutines interact with each other and the underlying system. This makes them very handy for debugging latency issues, since they tell you both when your goroutines are executing, and crucially, when they are not. The runtime/trace package provides an API for collecting an execution trace over a given time window by calling runtime/trace.Start and runtime/trace.Stop . This works well if the code you’re tracing is just a test, microbenchmark, or command line tool. You can collect a trace of the complete end-to-end execution, or just the parts you care about. However, in long-running web services, the kinds of applications Go is known for, that’s not good enough. Web servers might be up for days or even weeks, and collecting a trace of the entire execution would produce far too much data to sift through. Often just one part of the program’s execution goes wrong, like a request timing out or a failed health check. By the time it happens it’s already too late to call Start ! One way to approach this problem is to randomly sample execution traces from across the fleet. While this approach is powerful, and can help find issues before they become outages, it requires a lot of infrastructure to get going. Large quantities of execution trace data would need to be stored, triaged, and processed, much of which won’t contain anything interesting at all. And when you’re trying to get to the bottom of a specific issue, it’s a non-starter. Flight recording This brings us to the flight recorder. A program often knows when something has gone wrong, but the root cause may have happened long ago. The flight recorder lets you collect a trace of the last few seconds of execution leading up to the moment a program detects there’s been a problem. The flight recorder collects the execution trace as normal, but instead of writing it out to a socket or a file, it buffers the last few seconds of the trace in memory. At any point, the program can request the contents of the buffer and snapshot exactly the problematic window of time. The flight recorder is like a scalpel cutting directly to the problem area. Example Let’s learn how to use the flight recorder with an example. Specifically, let’s use it to diagnose a performance problem with an HTTP server that implements a “guess the number” game. It exposes a /guess-number endpoint that accepts an integer and responds to the caller informing them if they guessed the right number. There is also a goroutine that, once per minute, sends a report of all the guessed numbers to another service via an HTTP request. // bucket is a simple mutex-protected counter. type bucket struct { mu sync.Mutex guesses int } func main() { // Make one bucket for each valid number a client could guess. // The HTTP handler will look up the guessed number in buckets by // using the number as an index into the slice. buckets := make([]bucket, 100) // Every minute, we send a report of how many times each number was guessed. go func() { for range time.Tick(1 * time.Minute) { sendReport(buckets) } }() // Choose the number to be guessed. answer := rand.Intn(len(buckets)) http.HandleFunc(\"/guess-number\", func(w http.ResponseWriter, r *http.Request) { start := time.Now() // Fetch the number from the URL query variable \"guess\" and convert it // to an integer. Then, validate it. guess, err := strconv.Atoi(r.URL.Query().Get(\"guess\")) if err != nil || !(0 <= guess && guess < len(buckets)) { http.Error(w, \"invalid 'guess' value\", http.StatusBadRequest) return } // Select the appropriate bucket and safely increment its value. b := &buckets[guess] b.mu.Lock() b.guesses++ b.mu.Unlock() // Respond to the client with the guess and whether it was correct. fmt.Fprintf(w, \"guess: %d, correct: %t\", guess, guess == answer) log.Printf(\"HTTP request: endpoint=/guess-number guess=%d duration=%s\", guess, time.Since(start)) }) log.Fatal(http.ListenAndServe(\":8090\", nil)) } // sendReport posts the current state of buckets to a remote service. func sendReport(buckets []bucket) { counts := make([]int, len(buckets)) for index := range buckets { b := &buckets[index] b.mu.Lock() defer b.mu.Unlock() counts[index] = b.guesses } // Marshal the report data into a JSON payload. b, err := json.Marshal(counts) if err != nil { log.Printf(\"failed to marshal report data: error=%s\", err) return } url := \"http://localhost:8091/guess-number-report\" if _, err := http.Post(url, \"application/json\", bytes.NewReader(b)); err != nil { log.Printf(\"failed to send report: %s\", err) } } Here is the full code for the server: https://go.dev/play/p/rX1eyKtVglF , and for a simple client: https://go.dev/play/p/2PjQ-1ORPiw . To avoid a third process, the “client” also implements the report server, though in a real system this would be separate. Let’s suppose that after deploying the application in production, we received complaints from users that some /guess-number calls were taking longer than expected. When we look at our logs, we see that sometimes response times exceed 100 milliseconds, while the majority of calls are on the order of microseconds. 2025/09/19 16:52:02 HTTP request: endpoint=/guess-number guess=69 duration=625ns 2025/09/19 16:52:02 HTTP request: endpoint=/guess-number guess=62 duration=458ns 2025/09/19 16:52:02 HTTP request: endpoint=/guess-number guess=42 duration=1.417µs 2025/09/19 16:52:02 HTTP request: endpoint=/guess-number guess=86 duration=115.186167ms 2025/09/19 16:52:02 HTTP request: endpoint=/guess-number guess=0 duration=127.993375ms Before we continue, take a minute and see if you can spot what’s wrong! Regardless of whether you found the problem or not, let’s dive deeper and see how we can find the problem from first principles. In particular, it would be great if we could see what the application was doing in the time leading up to the slow response. This is exactly what the flight recorder was built for! We’ll use it to capture an execution trace once we see the first response exceeding 100 milliseconds. First, in main , we’ll configure and start the flight recorder: // Set up the flight recorder fr := trace.NewFlightRecorder(trace.FlightRecorderConfig{ MinAge: 200 * time.Millisecond, MaxBytes: 1 << 20, // 1 MiB }) fr.Start() MinAge configures the duration for which trace data is reliably retained, and we suggest setting it to around 2x the time window of the event. For example, if you are debugging a 5-second timeout, set it to 10 seconds. MaxBytes configures the size of the buffered trace so you don’t blow up your memory usage. On average, you can expect a few MB of trace data to be produced per second of execution, or 10 MB/s for a busy service. Next, we’ll add a helper function to capture the snapshot and write it to a file: var once sync.Once // captureSnapshot captures a flight recorder snapshot. func captureSnapshot(fr *trace.FlightRecorder) { // once.Do ensures that the provided function is executed only once. once.Do(func() { f, err := os.Create(\"snapshot.trace\") if err != nil { log.Printf(\"opening snapshot file %s failed: %s\", f.Name(), err) return } defer f.Close() // ignore error // WriteTo writes the flight recorder data to the provided io.Writer. _, err = fr.WriteTo(f) if err != nil { log.Printf(\"writing snapshot to file %s failed: %s\", f.Name(), err) return } // Stop the flight recorder after the snapshot has been taken. fr.Stop() log.Printf(\"captured a flight recorder snapshot to %s\", f.Name()) }) } And finally, just before logging a completed request, we’ll trigger the snapshot if the request took more than 100 milliseconds: // Capture a snapshot if the response takes more than 100ms. // Only the first call has any effect. if fr.Enabled() && time.Since(start) > 100*time.Millisecond { go captureSnapshot(fr) } Here’s the full code for the server, now instrumented with the flight recorder: https://go.dev/play/p/3V33gfIpmjG Now, we run the server again and send requests until we get a slow request that triggers a snapshot. Once we’ve gotten a trace, we’ll need a tool that will help us examine it. The Go toolchain provides a built-in execution trace analysis tool via the go tool trace command . Run go tool trace snapshot.trace to launch the tool, which starts a local web server, then open the displayed URL in your browser (if the tool doesn’t open your browser automatically). This tool gives us a few ways to look at the trace, but let’s focus on visualizing the trace to get a sense of what’s going on. Click “View trace by proc” to do so. In this view, the trace is presented as a timeline of events. At the top of the page, in the “STATS” section, we can see a summary of the application’s state, including the number of threads, the heap size, and the goroutine count. Below that, in the “PROCS” section, we can see how the execution of goroutines is mapped onto GOMAXPROCS (the number of operating system threads created by the Go application). We can see when and how each goroutine starts, runs, and finally stops executing. For now, let’s turn our attention to this massive gap in execution on the right side of the viewer. For a period of time, around 100ms, nothing is happening! By selecting the zoom tool (or pressing 3 ), we can inspect the section of the trace right after the gap with more detail. In addition to the activity of each individual goroutine, we can see how goroutines interact via “flow events.” An incoming flow event indicates what happened to make a goroutine start running. An outgoing flow edge indicates what effect one goroutine had on another. Enabling the visualization of all flow events often provides clues that hint at the source of a problem. In this case, we can see that many of the goroutines have a direct connection to a single goroutine right after the pause in activity. Clicking on the single goroutine shows an event table filled with outgoing flow events, which matches what we saw when the flow view was enabled. What happened when this goroutine ran? Part of the information stored in the trace is a view of the stack trace at different points in time. When we look at the goroutine we can see that the start stack trace shows that it was waiting for the HTTP request to complete when the goroutine was scheduled to run. And the end stack trace shows that the sendReport function had already returned and it was waiting for the ticker for the next scheduled time to send the report. Between the start and the end of this goroutine running, we see a huge number of “outgoing flows,” where it interacts with other goroutines. Clicking on one of the Outgoing flow entries takes us to a view of the interaction. This flow implicates the Unlock in sendReport : for index := range buckets { b := &buckets[index] b.mu.Lock() defer b.mu.Unlock() counts[index] = b.guesses } In sendReport , we intended to acquire a lock on each bucket and release the lock after copying the value. But here’s the problem: we don’t actually release the lock immediately after copying the value contained in bucket.guesses . Because we used a defer statement to release the lock, that release doesn’t happen until the function returns. We hold the lock not just past the end of the loop, but until after the HTTP request completes. That’s a subtle error that may be difficult to track down in a large production system. Fortunately, execution tracing helped us pinpoint the problem. However, if we tried to use the execution tracer in a long-running server without the new flight-recording mode, it would likely amass a huge amount of execution trace data, which an operator would have to store, transmit, and sift through. The flight recorder gives us the power of hindsight. It lets us capture just what went wrong, after it’s already happened, and quickly zero in on the cause. The flight recorder is just the latest addition to the Go developer’s toolbox for diagnosing the inner workings of running applications. We’ve steadily been improving tracing over the past couple of releases. Go 1.21 greatly reduced the run-time overhead of tracing. The trace format became more robust and also splittable in the Go 1.22 release, leading to features like the flight recorder. Open-source tools like gotraceui , and the forthcoming ability to programmatically parse execution traces are more ways to leverage the power of execution traces. The Diagnostics page lists many additional tools at your disposal. We hope you make use of them as you write and refine your Go applications. Thanks We’d like to take a moment to thank those community members who have been active in the diagnostics meetings, contributed to the designs, and provided feedback over the years: Felix Geisendörfer ( @felixge.de ), Nick Ripley ( @nsrip-dd ), Rhys Hiltner ( @rhysh ), Dominik Honnef ( @dominikh ), Bryan Boreham ( @bboreham ), and PJ Malloy ( @thepudds ). The discussions, feedback, and work you’ve all put in have been instrumental in pushing us to a better diagnostics future. Thank you!",
+    "quality_score": 8,
+    "modules": [
+      "observability",
+      "error_resilience",
+      "go_patterns"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2023/05/03/react-canaries",
+    "title": "React Canaries: Enabling Incremental Feature Rollout Outside Meta",
+    "source_name": "React Blog",
+    "text": "May 3, 2023 by Dan Abramov , Sophie Alpert , Rick Hanlon , Sebastian Markbåge , and Andrew Clark We’d like to offer the React community an option to adopt individual new features as soon as their design is close to final, before they’re released in a stable version—similar to how Meta has long used bleeding-edge versions of React internally. We are introducing a new officially supported Canary release channel . It lets curated setups like frameworks decouple adoption of individual React features from the React release schedule. tl;dr We’re introducing an officially supported Canary release channel for React. Since it’s officially supported, if any regressions land, we’ll treat them with a similar urgency to bugs in stable releases. Canaries let you start using individual new React features before they land in the semver-stable releases. Unlike the Experimental channel, React Canaries only include features that we reasonably believe to be ready for adoption. We encourage frameworks to consider bundling pinned Canary React releases. We will announce breaking changes and new features on our blog as they land in Canary releases. As always, React continues to follow semver for every Stable release. How React features are usually developed Typically, every React feature has gone through the same stages: We develop an initial version and prefix it with experimental_ or unstable_ . The feature is only available in the experimental release channel. At this point, the feature is expected to change significantly. We find a team at Meta willing to help us test this feature and provide feedback on it. This leads to a round of changes. As the feature becomes more stable, we work with more teams at Meta to try it out. Eventually, we feel confident in the design. We remove the prefix from the API name, and make the feature available on the main branch by default, which most Meta products use. At this point, any team at Meta can use this feature. As we build confidence in the direction, we also post an RFC for the new feature. At this point we know the design works for a broad set of cases, but we might make some last minute adjustments. When we are close to cutting an open source release, we write documentation for the feature and finally release the feature in a stable React release. This playbook works well for most features we’ve released so far. However, there can be a significant gap between when the feature is generally ready to use (step 3) and when it is released in open source (step 5). We’d like to offer the React community an option to follow the same approach as Meta, and adopt individual new features earlier (as they become available) without having to wait for the next release cycle of React. As always, all React features will eventually make it into a Stable release. Can we just do more minor releases? Generally, we do use minor releases for introducing new features. However, this isn’t always possible. Sometimes, new features are interconnected with other new features which have not yet been fully completed and that we’re still actively iterating on. We can’t release them separately because their implementations are related. We can’t version them separately because they affect the same packages (for example, react and react-dom ). And we need to keep the ability to iterate on the pieces that aren’t ready without a flurry of major version releases, which semver would require us to do. At Meta, we’ve solved this problem by building React from the main branch, and manually updating it to a specific pinned commit every week. This is also the approach that React Native releases have been following for the last several years. Every stable release of React Native is pinned to a specific commit from the main branch of the React repository. This lets React Native include important bugfixes and incrementally adopt new React features at the framework level without getting coupled to the global React release schedule. We would like to make this workflow available to other frameworks and curated setups. For example, it lets a framework on top of React include a React-related breaking change before this breaking change gets included into a stable React release. This is particularly useful because some breaking changes only affect framework integrations. This lets a framework release such a change in its own minor version without breaking semver. Rolling releases with the Canaries channel will allow us to have a tighter feedback loop and ensure that new features get comprehensive testing in the community. This workflow is closer to how TC39, the JavaScript standards committee, handles changes in numbered stages . New React features may be available in frameworks built on React before they are in a React stable release, just as new JavaScript features ship in browsers before they are officially ratified as part of the specification. Why not use experimental releases instead? Although you can technically use Experimental releases , we recommend against using them in production because experimental APIs can undergo significant breaking changes on their way to stabilization (or can even be removed entirely). While Canaries can also contain mistakes (as with any release), going forward we plan to announce any significant breaking changes in Canaries on our blog. Canaries are the closest to the code Meta runs internally, so you can generally expect them to be relatively stable. However, you do need to keep the version pinned and manually scan the GitHub commit log when updating between the pinned commits. We expect that most people using React outside a curated setup (like a framework) will want to continue using the Stable releases. However, if you’re building a framework, you might want to consider bundling a Canary version of React pinned to a particular commit, and update it at your own pace. The benefit of that is that it lets you ship individual completed React features and bugfixes earlier for your users and at your own release schedule, similar to how React Native has been doing it for the last few years. The downside is that you would take on additional responsibility to review which React commits are being pulled in and communicate to your users which React changes are included with your releases. If you’re a framework author and want to try this approach, please get in touch with us. Announcing breaking changes and new features early Canary releases represent our best guess of what will go into the next stable React release at any given time. Traditionally, we’ve only announced breaking changes at the end of the release cycle (when doing a major release). Now that Canary releases are an officially supported way to consume React, we plan to shift towards announcing breaking changes and significant new features as they land in Canaries. For example, if we merge a breaking change that will go out in a Canary, we will write a post about it on the React blog, including codemods and migration instructions if necessary. Then, if you’re a framework author cutting a major release that updates the pinned React canary to include that change, you can link to our blog post from your release notes. Finally, when a stable major version of React is ready, we will link to those already published blog posts, which we hope will help our team make progress faster. We plan to document APIs as they land in Canaries—even if these APIs are not yet available outside of them. APIs that are only available in Canaries will be marked with a special note on the corresponding pages. This will include APIs like use , and some others (like cache and createServerContext ) which we’ll send RFCs for. Canaries must be pinned If you decide to adopt the Canary workflow for your app or framework, make sure you always pin the exact version of the Canary you’re using. Since Canaries are pre-releases, they may still include breaking changes. Example: React Server Components As we announced in March , the React Server Components conventions have been finalized, and we do not expect significant breaking changes related to their user-facing API contract. However, we can’t release support for React Server Components in a stable version of React yet because we are still working on several intertwined framework-only features (such as asset loading ) and expect more breaking changes there. This means that React Server Components are ready to be adopted by frameworks. However, until the next major React release, the only way for a framework to adopt them is to ship a pinned Canary version of React. (To avoid bundling two copies of React, frameworks that wish to do this would need to enforce resolution of react and react-dom to the pinned Canary they ship with their framework, and explain that to their users. As an example, this is what Next.js App Router does.) Testing libraries against both Stable and Canary versions We do not expect library authors to test every single Canary release since it would be prohibitively difficult. However, just as when we originally introduced the different React pre-release channels three years ago , we encourage libraries to run tests against both the latest Stable and latest Canary versions. If you see a change in behavior that wasn’t announced, please file a bug in the React repository so that we can help diagnose it. We expect that as this practice becomes widely adopted, it will reduce the amount of effort necessary to upgrade libraries to new major versions of React, since accidental regressions would be found as they land. Note Strictly speaking, Canary is not a new release channel—it used to be called Next. However, we’ve decided to rename it to avoid confusion with Next.js. We’re announcing it as a new release channel to communicate the new expectations, such as Canaries being an officially supported way to use React. Stable releases work like before We are not introducing any changes to stable React releases.",
+    "quality_score": 8,
+    "modules": [
+      "react_patterns",
+      "evolutionary",
+      "dx"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023",
+    "title": "React Labs: What We've Been Working On – March 2023",
+    "source_name": "React Blog",
+    "text": "March 22, 2023 by Joseph Savona , Josh Story , Lauren Tan , Mengdi Chen , Samuel Susla , Sathya Gunasekaran , Sebastian Markbåge , and Andrew Clark In React Labs posts, we write about projects in active research and development. We’ve made significant progress on them since our last update , and we’d like to share what we learned. React Server Components React Server Components (or RSC) is a new application architecture designed by the React team. We’ve first shared our research on RSC in an introductory talk and an RFC . To recap them, we are introducing a new kind of component—Server Components—that run ahead of time and are excluded from your JavaScript bundle. Server Components can run during the build, letting you read from the filesystem or fetch static content. They can also run on the server, letting you access your data layer without having to build an API. You can pass data by props from Server Components to the interactive Client Components in the browser. RSC combines the simple “request/response” mental model of server-centric Multi-Page Apps with the seamless interactivity of client-centric Single-Page Apps, giving you the best of both worlds. Since our last update, we have merged the React Server Components RFC to ratify the proposal. We resolved outstanding issues with the React Server Module Conventions proposal, and reached consensus with our partners to go with the \"use client\" convention. These documents also act as specification for what an RSC-compatible implementation should support. The biggest change is that we introduced async / await as the primary way to do data fetching from Server Components. We also plan to support data loading from the client by introducing a new Hook called use that unwraps Promises. Although we can’t support async / await in arbitrary components in client-only apps, we plan to add support for it when you structure your client-only app similar to how RSC apps are structured. Now that we have data fetching pretty well sorted, we’re exploring the other direction: sending data from the client to the server, so that you can execute database mutations and implement forms. We’re doing this by letting you pass Server Action functions across the server/client boundary, which the client can then call, providing seamless RPC. Server Actions also give you progressively enhanced forms before JavaScript loads. React Server Components has shipped in Next.js App Router . This showcases a deep integration of a router that really buys into RSC as a primitive, but it’s not the only way to build a RSC-compatible router and framework. There’s a clear separation for features provided by the RSC spec and implementation. React Server Components is meant as a spec for components that work across compatible React frameworks. We generally recommend using an existing framework, but if you need to build your own custom framework, it is possible. Building your own RSC-compatible framework is not as easy as we’d like it to be, mainly due to the deep bundler integration needed. The current generation of bundlers are great for use on the client, but they weren’t designed with first-class support for splitting a single module graph between the server and the client. This is why we’re now partnering directly with bundler developers to get the primitives for RSC built-in. Asset Loading Suspense lets you specify what to display on the screen while the data or code for your components is still being loaded. This lets your users progressively see more content while the page is loading as well as during the router navigations that load more data and code. However, from the user’s perspective, data loading and rendering do not tell the whole story when considering whether new content is ready. By default, browsers load stylesheets, fonts, and images independently, which can lead to UI jumps and consecutive layout shifts. We’re working to fully integrate Suspense with the loading lifecycle of stylesheets, fonts, and images, so that React takes them into account to determine whether the content is ready to be displayed. Without any change to the way you author your React components, updates will behave in a more coherent and pleasing manner. As an optimization, we will also provide a manual way to preload assets like fonts directly from components. We are currently implementing these features and will have more to share soon. Document Metadata Different pages and screens in your app may have different metadata like the <title> tag, description, and other <meta> tags specific to this screen. From the maintenance perspective, it’s more scalable to keep this information close to the React component for that page or screen. However, the HTML tags for this metadata need to be in the document <head> which is typically rendered in a component at the very root of your app. Today, people solve this problem with one of the two techniques. One technique is to render a special third-party component that moves <title> , <meta> , and other tags inside it into the document <head> . This works for major browsers but there are many clients which do not run client-side JavaScript, such as Open Graph parsers, and so this technique is not universally suitable. Another technique is to server-render the page in two parts. First, the main content is rendered and all such tags are collected. Then, the <head> is rendered with these tags. Finally, the <head> and the main content are sent to the browser. This approach works, but it prevents you from taking advantage of the React 18’s Streaming Server Renderer because you’d have to wait for all content to render before sending the <head> . This is why we’re adding built-in support for rendering <title> , <meta> , and metadata <link> tags anywhere in your component tree out of the box. It would work the same way in all environments, including fully client-side code, SSR, and in the future, RSC. We will share more details about this soon. React Optimizing Compiler Since our previous update we’ve been actively iterating on the design of React Forget , an optimizing compiler for React. We’ve previously talked about it as an “auto-memoizing compiler”, and that is true in some sense. But building the compiler has helped us understand React’s programming model even more deeply. A better way to understand React Forget is as an automatic reactivity compiler. The core idea of React is that developers define their UI as a function of the current state. You work with plain JavaScript values — numbers, strings, arrays, objects — and use standard JavaScript idioms — if/else, for, etc — to describe your component logic. The mental model is that React will re-render whenever the application state changes. We believe this simple mental model and keeping close to JavaScript semantics is an important principle in React’s programming model. The catch is that React can sometimes be too reactive: it can re-render too much. For example, in JavaScript we don’t have cheap ways to compare if two objects or arrays are equivalent (having the same keys and values), so creating a new object or array on each render may cause React to do more work than it strictly needs to. This means developers have to explicitly memoize components so as to not over-react to changes. Our goal with React Forget is to ensure that React apps have just the right amount of reactivity by default: that apps re-render only when state values meaningfully change. From an implementation perspective this means automatically memoizing, but we believe that the reactivity framing is a better way to understand React and Forget. One way to think about this is that React currently re-renders when object identity changes. With Forget, React re-renders when the semantic value changes — but without incurring the runtime cost of deep comparisons. In terms of concrete progress, since our last update we have substantially iterated on the design of the compiler to align with this automatic reactivity approach and to incorporate feedback from using the compiler internally. After some significant refactors to the compiler starting late last year, we’ve now begun using the compiler in production in limited areas at Meta. We plan to open-source it once we’ve proved it in production. Finally, a lot of people have expressed interest in how the compiler works. We’re looking forward to sharing a lot more details when we prove the compiler and open-source it. But there are a few bits we can share now: The core of the compiler is almost completely decoupled from Babel, and the core compiler API is (roughly) old AST in, new AST out (while retaining source location data). Under the hood we use a custom code representation and transformation pipeline in order to do low-level semantic analysis. However, the primary public interface to the compiler will be via Babel and other build system plugins. For ease of testing we currently have a Babel plugin which is a very thin wrapper that calls the compiler to generate a new version of each function and swap it in. As we refactored the compiler over the last few months, we wanted to focus on refining the core compilation model to ensure we could handle complexities such as conditionals, loops, reassignment, and mutation. However, JavaScript has a lot of ways to express each of those features: if/else, ternaries, for, for-in, for-of, etc. Trying to support the full language up-front would have delayed the point where we could validate the core model. Instead, we started with a small but representative subset of the language: let/const, if/else, for loops, objects, arrays, primitives, function calls, and a few other features. As we gained confidence in the core model and refined our internal abstractions, we expanded the supported language subset. We’re also explicit about syntax we don’t yet support, logging diagnostics and skipping compilation for unsupported input. We have utilities to try the compiler on Meta’s codebases and see what unsupported features are most common so we can prioritize those next. We’ll continue incrementally expanding towards supporting the whole language. Making plain JavaScript in React components reactive requires a compiler with a deep understanding of semantics so that it can understand exactly what the code is doing. By taking this approach, we’re creating a system for reactivity within JavaScript that lets you write product code of any complexity with the full expressivity of the language, instead of being limited to a domain specific language. Offscreen Rendering Offscreen rendering is an upcoming capability in React for rendering screens in the background without additional performance overhead. You can think of it as a version of the content-visibility CSS property that works not only for DOM elements but React components, too. During our research, we’ve discovered a variety of use cases: A router can prerender screens in the background so that when a user navigates to them, they’re instantly available. A tab switching component can preserve the state of hidden tabs, so the user can switch between them without losing their progress. A virtualized list component can prerender additional rows above and below the visible window. When opening a modal or popup, the rest of the app can be put into “background” mode so that events and updates are disabled for everything except the modal. Most React developers will not interact with React’s offscreen APIs directly. Instead, offscreen rendering will be integrated into things like routers and UI libraries, and then developers who use those libraries will automatically benefit without additional work. The idea is that you should be able to render any React tree offscreen without changing the way you write your components. When a component is rendered offscreen, it does not actually mount until the component becomes visible — its effects are not fired. For example, if a component uses useEffect to log analytics when it appears for the first time, prerendering won’t mess up the accuracy of those analytics. Similarly, when a component goes offscreen, its effects are unmounted, too. A key feature of offscreen rendering is that you can toggle the visibility of a component without losing its state. Since our last update, we’ve tested an experimental version of prerendering internally at Meta in our React Native apps on Android and iOS, with positive performance results. We’ve also improved how offscreen rendering works with Suspense — suspending inside an offscreen tree will not trigger Suspense fallbacks. Our remaining work involves finalizing the primitives that are exposed to library developers. We expect to publish an RFC later this year, alongside an experimental API for testing and feedback. Transition Tracing The Transition Tracing API lets you detect when React Transitions become slower and investigate why they may be slow. Following our last update, we have completed the initial design of the API and published an RFC . The basic capabilities have also been implemented. The project is currently on hold. We welcome feedback on the RFC and look forward to resuming its development to provide a better performance measurement tool for React. This will be particularly useful with routers built on top of React Transitions, like the Next.js App Router . In addition to this update, our team has made recent guest appearances on community podcasts and livestreams to speak more on our work and answer questions. Dan Abramov and Joe Savona were interviewed by Kent C. Dodds on his YouTube channel , where they discussed concerns around React Server Components. Dan Abramov and Joe Savona were guests on the JSParty podcast and shared their thoughts about the future of React. Thanks to Andrew Clark , Dan Abramov , Dave McCabe , Luna Wei , Matt Carroll , Sean Keegan , Sebastian Silbermann , Seth Webster , and Sophie Alpert for reviewing this post. Thanks for reading, and see you in the next update!",
+    "quality_score": 8,
+    "modules": [
+      "react_patterns",
+      "evolutionary",
+      "architecture_patterns"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2023/03/16/introducing-react-dev",
+    "title": "Introducing react.dev",
+    "source_name": "React Blog",
+    "text": "March 16, 2023 by Dan Abramov and Rachel Nabors Today we are thrilled to launch react.dev , the new home for React and its documentation. In this post, we would like to give you a tour of the new site. tl;dr The new React site ( react.dev ) teaches modern React with function components and Hooks. We’ve included diagrams, illustrations, challenges, and over 600 new interactive examples. The previous React documentation site has now moved to legacy.reactjs.org . New site, new domain, new homepage First, a little bit of housekeeping. To celebrate the launch of the new docs and, more importantly, to clearly separate the old and the new content, we’ve moved to the shorter react.dev domain. The old reactjs.org domain will now redirect here. The old React docs are now archived at legacy.reactjs.org . All existing links to the old content will automatically redirect there to avoid “breaking the web”, but the legacy site will not get many more updates. Believe it or not, React will soon be ten years old. In JavaScript years, it’s like a whole century! We’ve refreshed the React homepage to reflect why we think React is a great way to create user interfaces today, and updated the getting started guides to more prominently mention modern React-based frameworks. If you haven’t seen the new homepage yet, check it out! Going all-in on modern React with Hooks When we released React Hooks in 2018, the Hooks docs assumed the reader is familiar with class components. This helped the community adopt Hooks very swiftly, but after a while the old docs failed to serve the new readers. New readers had to learn React twice: once with class components and then once again with Hooks. The new docs teach React with Hooks from the beginning. The docs are divided in two main sections: Learn React is a self-paced course that teaches React from scratch. API Reference provides the details and usage examples for every React API. Let’s have a closer look at what you can find in each section. Note There are still a few rare class component use cases that do not yet have a Hook-based equivalent. Class components remain supported, and are documented in the Legacy API section of the new site. Quick start The Learn section begins with the Quick Start page. It is a short introductory tour of React. It introduces the syntax for concepts like components, props, and state, but doesn’t go into much detail on how to use them. If you like to learn by doing, we recommend checking out the Tic-Tac-Toe Tutorial next. It walks you through building a little game with React, while teaching the skills you’ll use every day. Here’s what you’ll build: import { useState } from 'react' ; function Square ( { value , onSquareClick } ) { return ( < button className = \"square\" onClick = { onSquareClick } > { value } </ button > ) ; } function Board ( { xIsNext , squares , onPlay } ) { function handleClick ( i ) { if ( calculateWinner ( squares ) || squares [ i ] ) { return ; } const nextSquares = squares . slice ( ) ; if ( xIsNext ) { nextSquares [ i ] = 'X' ; } else { nextSquares [ i ] = 'O' ; } onPlay ( nextSquares ) ; } const winner = calculateWinner ( squares ) ; let status ; if ( winner ) { status = 'Winner: ' + winner ; } else { status = 'Next player: ' + ( xIsNext ? 'X' : 'O' ) ; } return ( < > < div className = \"status\" > { status } </ div > < div className = \"board-row\" > < Square value = { squares [ 0 ] } onSquareClick = { ( ) => handleClick ( 0 ) } /> < Square value = { squares [ 1 ] } onSquareClick = { ( ) => handleClick ( 1 ) } /> < Square value = { squares [ 2 ] } onSquareClick = { ( ) => handleClick ( 2 ) } /> </ div > < div className = \"board-row\" > < Square value = { squares [ 3 ] } onSquareClick = { ( ) => handleClick ( 3 ) } /> < Square value = { squares [ 4 ] } onSquareClick = { ( ) => handleClick ( 4 ) } /> < Square value = { squares [ 5 ] } onSquareClick = { ( ) => handleClick ( 5 ) } /> </ div > < div className = \"board-row\" > < Square value = { squares [ 6 ] } onSquareClick = { ( ) => handleClick ( 6 ) } /> < Square value = { squares [ 7 ] } onSquareClick = { ( ) => handleClick ( 7 ) } /> < Square value = { squares [ 8 ] } onSquareClick = { ( ) => handleClick ( 8 ) } /> </ div > </ > ) ; } export default function Game ( ) { const [ history , setHistory ] = useState ( [ Array ( 9 ) . fill ( null ) ] ) ; const [ currentMove , setCurrentMove ] = useState ( 0 ) ; const xIsNext = currentMove % 2 === 0 ; const currentSquares = history [ currentMove ] ; function handlePlay ( nextSquares ) { const nextHistory = [ ... history . slice ( 0 , currentMove + 1 ) , nextSquares ] ; setHistory ( nextHistory ) ; setCurrentMove ( nextHistory . length - 1 ) ; } function jumpTo ( nextMove ) { setCurrentMove ( nextMove ) ; } const moves = history . map ( ( squares , move ) => { let description ; if ( move > 0 ) { description = 'Go to move #' + move ; } else { description = 'Go to game start' ; } return ( < li key = { move } > < button onClick = { ( ) => jumpTo ( move ) } > { description } </ button > </ li > ) ; } ) ; return ( < div className = \"game\" > < div className = \"game-board\" > < Board xIsNext = { xIsNext } squares = { currentSquares } onPlay = { handlePlay } /> </ div > < div className = \"game-info\" > < ol > { moves } </ ol > </ div > </ div > ) ; } function calculateWinner ( squares ) { const lines = [ [ 0 , 1 , 2 ] , [ 3 , 4 , 5 ] , [ 6 , 7 , 8 ] , [ 0 , 3 , 6 ] , [ 1 , 4 , 7 ] , [ 2 , 5 , 8 ] , [ 0 , 4 , 8 ] , [ 2 , 4 , 6 ] , ] ; for ( let i = 0 ; i < lines . length ; i ++ ) { const [ a , b , c ] = lines [ i ] ; if ( squares [ a ] && squares [ a ] === squares [ b ] && squares [ a ] === squares [ c ] ) { return squares [ a ] ; } } return null ; } We’d also like to highlight Thinking in React —that’s the tutorial that made React “click” for many of us. We’ve updated both of these classic tutorials to use function components and Hooks, so they’re as good as new. Note The example above is a sandbox . We’ve added a lot of sandboxes—over 600!—everywhere throughout the site. You can edit any sandbox, or press “Fork” in the upper right corner to open it in a separate tab. Sandboxes let you quickly play with the React APIs, explore your ideas, and check your understanding. Learn React step by step We’d like everyone in the world to have an equal opportunity to learn React for free on their own. This is why the Learn section is organized like a self-paced course split into chapters. The first two chapters describe the fundamentals of React. If you’re new to React, or want to refresh it in your memory, start here: Describing the UI teaches how to display information with components. Adding Interactivity teaches how to update the screen in response to user input. The next two chapters are more advanced, and will give you a deeper insight into the trickier parts: Managing State teaches how to organize your logic as your app grows in complexity. Escape Hatches teaches how you can “step outside” React, and when it makes most sense to do so. Every chapter consists of several related pages. Most of these pages teach a specific skill or a technique—for example, Writing Markup with JSX , Updating Objects in State , or Sharing State Between Components . Some of the pages focus on explaining an idea—like Render and Commit , or State as a Snapshot . And there are a few, like You Might Not Need an Effect , that share our suggestions based on what we’ve learned over these years. You don’t have to read these chapters as a sequence. Who has the time for this?! But you could. Pages in the Learn section only rely on concepts introduced by the earlier pages. If you want to read it like a book, go for it! Check your understanding with challenges Most pages in the Learn section end with a few challenges to check your understanding. For example, here are a few challenges from the page about Conditional Rendering . You don’t have to solve them right now! Unless you really want to. Challenge 1 of 2 : Show an icon for incomplete items with ? : Use the conditional operator ( cond ? a : b ) to render a ❌ if isPacked isn’t true . function Item ( { name , isPacked } ) { return ( < li className = \"item\" > { name } { isPacked && '✅' } </ li > ) ; } export default function PackingList ( ) { return ( < section > < h1 > Sally Ride's Packing List </ h1 > < ul > < Item isPacked = { true } name = \"Space suit\" /> < Item isPacked = { true } name = \"Helmet with a golden leaf\" /> < Item isPacked = { false } name = \"Photo of Tam\" /> </ ul > </ section > ) ; } Notice the “Show solution” button in the left bottom corner. It’s handy if you want to check yourself! Build an intuition with diagrams and illustrations When we couldn’t figure out how to explain something with code and words alone, we’ve added diagrams that help provide some intuition. For example, here is one of the diagrams from Preserving and Resetting State : When section changes to div , the section is deleted and the new div is added You’ll also see some illustrations throughout the docs—here’s one of the browser painting the screen : We’ve confirmed with the browser vendors that this depiction is 100% scientifically accurate. A new, detailed API Reference In the API Reference , every React API now has a dedicated page. This includes all kinds of APIs: Built-in Hooks like useState . Built-in components like <Suspense> . Built-in browser components like <input> . Framework-oriented APIs like renderToPipeableStream . Other React APIs like memo . You’ll notice that every API page is split into at least two segments: Reference and Usage . Reference describes the formal API signature by listing its arguments and return values. It’s concise, but it can feel a bit abstract if you’re not familiar with that API. It describes what an API does, but not how to use it. Usage shows why and how you would use this API in practice, like a colleague or a friend might explain. It shows the canonical scenarios for how each API was meant to be used by the React team. We’ve added color-coded snippets, examples of using different APIs together, and recipes that you can copy and paste from: Example 1 of 4 : Counter (number) In this example, the count state variable holds a number. Clicking the button increments it. Some API pages also include Troubleshooting (for common problems) and Alternatives (for deprecated APIs). We hope that this approach will make the API reference useful not only as a way to look up an argument, but as a way to see all the different things you can do with any given API—and how it connects to the other ones. What’s next? That’s a wrap for our little tour! Have a look around the new website, see what you like or don’t like, and keep the feedback coming in our issue tracker . We acknowledge this project has taken a long time to ship. We wanted to maintain a high quality bar that the React community deserves. While writing these docs and creating all of the examples, we found mistakes in some of our own explanations, bugs in React, and even gaps in the React design that we are now working to address. We hope that the new documentation will help us hold React itself to a higher bar in the future. We’ve heard many of your requests to expand the content and functionality of the website, for example: Providing a TypeScript version for all examples; Creating the updated performance, testing, and accessibility guides; Documenting React Server Components independently from the frameworks that support them; Working with our international community to get the new docs translated; Adding missing features to the new website (for example, RSS for this blog). Now that react.dev is out, we will be able to shift our focus from “catching up” with the third-party React educational resources to adding new information and further improving our new website. We think there’s never been a better time to learn React. Who worked on this? On the React team, Rachel Nabors led the project (and provided the illustrations), and Dan Abramov designed the curriculum. They co-authored most of the content together as well. Of course, no project this large happens in isolation. We have a lot of people to thank! Sylwia Vargas overhauled our examples to go beyond “foo/bar/baz” and kittens, and feature scientists, artists and cities from around the world. Maggie Appleton turned our doodles into a clear diagram system. Thanks to David McCabe , Sophie Alpert , Rick Hanlon , Andrew Clark , and Matt Carroll for additional writing contributions. We’d also like to thank Natalia Tepluhina and Sebastian Markbåge for their ideas and feedback. Thanks to Dan Lebowitz for the site design and Razvan Gradinar for the sandbox design. On the development front, thanks to Jared Palmer for prototype development. Thanks to Dane Grant and Dustin Goodman from ThisDotLabs for their support on UI development. Thanks to Ives van Hoorne , Alex Moldovan , Jasper De Moor , and Danilo Woznica from CodeSandbox for their work with sandbox integration. Thanks to Rick Hanlon for spot development and design work, finessing our colors and finer details. Thanks to Harish Kumar and Luna Ruan for adding new features to the site and helping maintain it. Huge thanks to the folks who volunteered their time to participate in the alpha and beta testing program. Your enthusiasm and invaluable feedback helped us shape these docs. A special shout out to our beta tester, Debbie O’Brien , who gave a talk about her experience using the React docs at React Conf 2021. Finally, thanks to the React community for being the inspiration behind this effort. You are the reason we do this, and we hope that the new docs will help you use React to build any user interface that you want.",
+    "quality_score": 7,
+    "modules": [
+      "dx",
+      "react_patterns",
+      "design_patterns"
+    ]
+  },
+  {
+    "url": "https://react.dev/blog/2022/06/15/react-labs-what-we-have-been-working-on-june-2022",
+    "title": "React Labs: What We've Been Working On – June 2022",
+    "source_name": "React Blog",
+    "text": "June 15, 2022 by Andrew Clark , Dan Abramov , Jan Kassens , Joseph Savona , Josh Story , Lauren Tan , Luna Ruan , Mengdi Chen , Rick Hanlon , Robert Zhang , Sathya Gunasekaran , Sebastian Markbåge , and Xuan Huang React 18 was years in the making, and with it brought valuable lessons for the React team. Its release was the result of many years of research and exploring many paths. Some of those paths were successful; many more were dead-ends that led to new insights. One lesson we’ve learned is that it’s frustrating for the community to wait for new features without having insight into these paths that we’re exploring. We typically have a number of projects being worked on at any time, ranging from the more experimental to the clearly defined. Looking ahead, we’d like to start regularly sharing more about what we’ve been working on with the community across these projects. To set expectations, this is not a roadmap with clear timelines. Many of these projects are under active research and are difficult to put concrete ship dates on. They may possibly never even ship in their current iteration depending on what we learn. Instead, we want to share with you the problem spaces we’re actively thinking about, and what we’ve learned so far. Server Components We announced an experimental demo of React Server Components (RSC) in December 2020. Since then we’ve been finishing up its dependencies in React 18, and working on changes inspired by experimental feedback. In particular, we’re abandoning the idea of having forked I/O libraries (eg react-fetch), and instead adopting an async/await model for better compatibility. This doesn’t technically block RSC’s release because you can also use routers for data fetching. Another change is that we’re also moving away from the file extension approach in favor of annotating boundaries . We’re working together with Vercel and Shopify to unify bundler support for shared semantics in both webpack and Vite. Before launch, we want to make sure that the semantics of RSCs are the same across the whole React ecosystem. This is the major blocker for reaching stable. Asset Loading Currently, assets like scripts, external styles, fonts, and images are typically preloaded and loaded using external systems. This can make it tricky to coordinate across new environments like streaming, Server Components, and more. We’re looking at adding APIs to preload and load deduplicated external assets through React APIs that work in all React environments. We’re also looking at having these support Suspense so you can have images, CSS, and fonts that block display until they’re loaded but don’t block streaming and concurrent rendering. This can help avoid “popcorning“ as the visuals pop and layout shifts. Static Server Rendering Optimizations Static Site Generation (SSG) and Incremental Static Regeneration (ISR) are great ways to get performance for cacheable pages, but we think we can add features to improve performance of dynamic Server Side Rendering (SSR) – especially when most but not all of the content is cacheable. We’re exploring ways to optimize server rendering utilizing compilation and static passes. React Optimizing Compiler We gave an early preview of React Forget at React Conf 2021. It’s a compiler that automatically generates the equivalent of useMemo and useCallback calls to minimize the cost of re-rendering, while retaining React’s programming model. Recently, we finished a rewrite of the compiler to make it more reliable and capable. This new architecture allows us to analyze and memoize more complex patterns such as the use of local mutations , and opens up many new compile-time optimization opportunities beyond just being on par with memoization Hooks. We’re also working on a playground for exploring many aspects of the compiler. While the goal of the playground is to make development of the compiler easier, we think that it will make it easier to try it out and build intuition for what the compiler does. It reveals various insights into how it works under the hood, and live renders the compiler’s outputs as you type. This will be shipped together with the compiler when it’s released. Offscreen Today, if you want to hide and show a component, you have two options. One is to add or remove it from the tree completely. The problem with this approach is that the state of your UI is lost each time you unmount, including state stored in the DOM, like scroll position. The other option is to keep the component mounted and toggle the appearance visually using CSS. This preserves the state of your UI, but it comes at a performance cost, because React must keep rendering the hidden component and all of its children whenever it receives new updates. Offscreen introduces a third option: hide the UI visually, but deprioritize its content. The idea is similar in spirit to the content-visibility CSS property: when content is hidden, it doesn’t need to stay in sync with the rest of the UI. React can defer the rendering work until the rest of the app is idle, or until the content becomes visible again. Offscreen is a low level capability that unlocks high level features. Similar to React’s other concurrent features like startTransition , in most cases you won’t interact with the Offscreen API directly, but instead via an opinionated framework to implement patterns like: Instant transitions. Some routing frameworks already prefetch data to speed up subsequent navigations, like when hovering over a link. With Offscreen, they’ll also be able to prerender the next screen in the background. Reusable state. Similarly, when navigating between routes or tabs, you can use Offscreen to preserve the state of the previous screen so you can switch back and pick up where you left off. Virtualized list rendering. When displaying large lists of items, virtualized list frameworks will prerender more rows than are currently visible. You can use Offscreen to prerender the hidden rows at a lower priority than the visible items in the list. Backgrounded content. We’re also exploring a related feature for deprioritizing content in the background without hiding it, like when displaying a modal overlay. Transition Tracing Currently, React has two profiling tools. The original Profiler shows an overview of all the commits in a profiling session. For each commit, it also shows all components that rendered and the amount of time it took for them to render. We also have a beta version of a Timeline Profiler introduced in React 18 that shows when components schedule updates and when React works on these updates. Both of these profilers help developers identify performance problems in their code. We’ve realized that developers don’t find knowing about individual slow commits or components out of context that useful. It’s more useful to know about what actually causes the slow commits. And that developers want to be able to track specific interactions (eg a button click, an initial load, or a page navigation) to watch for performance regressions and to understand why an interaction was slow and how to fix it. We previously tried to solve this issue by creating an Interaction Tracing API , but it had some fundamental design flaws that reduced the accuracy of tracking why an interaction was slow and sometimes resulted in interactions never ending. We ended up removing this API because of these issues. We are working on a new version for the Interaction Tracing API (tentatively called Transition Tracing because it is initiated via startTransition ) that solves these problems. New React Docs Last year, we announced the beta version of the new React documentation website ( later shipped as react.dev ) of the new React documentation website. The new learning materials teach Hooks first and has new diagrams, illustrations, as well as many interactive examples and challenges. We took a break from that work to focus on the React 18 release, but now that React 18 is out, we’re actively working to finish and ship the new documentation. We are currently writing a detailed section about effects, as we’ve heard that is one of the more challenging topics for both new and experienced React users. Synchronizing with Effects is the first published page in the series, and there are more to come in the following weeks. When we first started writing a detailed section about effects, we’ve realized that many common effect patterns can be simplified by adding a new primitive to React. We’ve shared some initial thoughts on that in the useEvent RFC . It is currently in early research, and we are still iterating on the idea. We appreciate the community’s comments on the RFC so far, as well as the feedback and contributions to the ongoing documentation rewrite. We’d specifically like to thank Harish Kumar for submitting and reviewing many improvements to the new website implementation. Thanks to Sophie Alpert for reviewing this blog post!",
+    "quality_score": 8,
+    "modules": [
+      "react_patterns",
+      "evolutionary",
```

### Commit 5: 8056344
**Message:** feat: rank daily post candidates and use haiku matching

**Diff:**
```diff
--- src/ai/post-generator.ts
diff --git a/src/ai/post-generator.ts b/src/ai/post-generator.ts
index cbbafc3..31982ab 100644
--- a/src/ai/post-generator.ts
+++ b/src/ai/post-generator.ts
@@ -12,6 +12,7 @@ export interface GeneratedPosts {
   shortPost: string;      // short variant for Twitter/X
   bufferText: string;     // combined text for Buffer Idea
   draftId: string;
+  openingMove: string;
 }
 
 export interface GeneratePostsOptions {
@@ -98,7 +99,7 @@ export async function generatePosts(
 
   logger.info('ai.generate.done', { sha: commit.sha, draftId });
 
-  return { linkedinPost: post, shortPost, bufferText, draftId };
+  return { linkedinPost: post, shortPost, bufferText, draftId, openingMove };
 }
 
 function parseResponse(raw: string): { post: string; shortPost: string } {


--- src/config/schema.ts
diff --git a/src/config/schema.ts b/src/config/schema.ts
index c8b40fe..ad1f930 100644
--- a/src/config/schema.ts
+++ b/src/config/schema.ts
@@ -118,6 +118,7 @@ export const ConfigSchema = z.object({
     interesting_min_lines: z.number().int().min(1).default(10),
     voice_examples_count: z.number().int().min(1).max(10).default(5),
     max_pending_drafts: z.number().int().min(1).default(10),
+    max_daily_posts_per_author: z.number().int().min(1).default(2),
     analysis_top_n: z.number().int().min(1).max(7).default(3),
   }),
   ai: z.object({


--- src/main-poll.ts
diff --git a/src/main-poll.ts b/src/main-poll.ts
index b3e74cc..68dbdbf 100644
--- a/src/main-poll.ts
+++ b/src/main-poll.ts
@@ -9,8 +9,9 @@ import { logger } from './utils/logger.js';
 import { isInteresting } from './utils/commit-filter.js';
 import { GitHubClient } from './github/client.js';
 import { pollNewPushEvents } from './github/events-poller.js';
-import { enrichCommit } from './github/commit-enricher.js';
+import { enrichCommit, type EnrichedCommit } from './github/commit-enricher.js';
 import { runPipeline } from './analysis/pipeline.js';
+import type { Finding } from './analysis/types.js';
 import { loadPlugins } from './analysis/plugin-loader.js';
 import { MODULE_REGISTRY } from './analysis/modules/index.js';
 import { createAIClient } from './ai/factory.js';
@@ -20,10 +21,39 @@ import { publishToBuffer } from './buffer/publisher.js';
 import { notifyNewDraft } from './review/notifier.js';
 import { SqliteStorage } from './voice/sqlite-storage.js';
 import { SupabaseStorage } from './voice/supabase-storage.js';
-import type { IVoiceStorage } from './voice/storage.js';
+import type { IVoiceStorage, VoicePost, VoiceStage } from './voice/storage.js';
+import type { VoiceProfile } from './config/schema.js';
 import { mergeVoiceProfile } from './voice/profile-utils.js';
 import { buildChapterContext, buildVarietyConstraint } from './ai/prompt-builder.js';
 import { computeVoiceStage } from './voice/stage.js';
+import {
+  buildModuleFireCounts,
+  computeCandidateRankingScore,
+  getStartOfDayIso,
+  selectTopDailyCandidates,
+  type RankedCommitCandidate,
+} from './worker/daily-post-selection.js';
+
+type TodayDraftState = Pick<VoicePost, 'created_at' | 'opening_move' | 'top_module_id'>;
+
+interface PollAuthorState {
+  readonly authorLogin: string | null;
+  readonly voiceProfile: VoiceProfile;
+  readonly hasBootstrap: boolean;
+  uniquePublished: number;
+  voiceStage: VoiceStage;
+  todayDrafts: TodayDraftState[];
+}
+
+interface PollCommitCandidate extends RankedCommitCandidate {
+  readonly commit: EnrichedCommit;
+  readonly findings: Finding[];
+  readonly authorKey: string;
+  readonly authorLogin: string | null;
+  readonly owner: string;
+  readonly repoName: string;
+  readonly voiceProfile: VoiceProfile;
+}
 
 async function main(): Promise<void> {
   const config = loadConfig();
@@ -65,6 +95,41 @@ async function main(): Promise<void> {
   );
 
   logger.info('poll.events_found', { count: events.length });
+  const recentModuleIds = await storage.getRecentModuleIds(30);
+  const recentModuleFireCounts = buildModuleFireCounts(recentModuleIds);
+  const dayStartIso = getStartOfDayIso(config.scheduling.timezone);
+  const dailyLimit = config.posting.max_daily_posts_per_author;
+  const authorStates = new Map<string, PollAuthorState>();
+  const candidatesByAuthor = new Map<string, PollCommitCandidate[]>();
+
+  const getAuthorState = async (authorLogin: string | null, commitSha: string): Promise<{
+    authorKey: string;
+    state: PollAuthorState;
+  }> => {
+    const authorKey = authorLogin ?? `unknown:${commitSha}`;
+    const existing = authorStates.get(authorKey);
+    if (existing) return { authorKey, state: existing };
+
+    const storedVoiceProfile = await storage.getVoiceProfile(authorLogin);
+    const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
+    const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
+    const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
+    const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);
+    const todayDrafts = authorLogin
+      ? (await storage.getDraftsSince(authorLogin, dayStartIso)).map(toTodayDraftState)
+      : [];
+
+    const state: PollAuthorState = {
+      authorLogin,
+      voiceProfile,
+      hasBootstrap,
+      uniquePublished,
+      voiceStage,
+      todayDrafts,
+    };
+    authorStates.set(authorKey, state);
+    return { authorKey, state };
+  };
 
   for (const pushEvent of events) {
     const [owner, repo] = pushEvent.repo.split('/');
@@ -105,73 +170,160 @@ async function main(): Promise<void> {
         continue;
       }
 
-      // Run analysis modules (freshness multiplier uses last 30 days of module history)
-      const recentModuleIds = await storage.getRecentModuleIds(30);
-      const findings = await runPipeline(
+      const { authorKey, state: authorState } = await getAuthorState(commit.authorLogin ?? null, commit.sha);
+      if (authorState.authorLogin && authorState.todayDrafts.length >= dailyLimit) {
+        logger.info('poll.skip.daily_limit_reached', {
+          sha: commit.sha,
+          authorLogin: authorState.authorLogin,
+          draftsToday: authorState.todayDrafts.length,
+          dailyLimit,
+        });
+        continue;
+      }
+
+      const pipelineFindings = await runPipeline(
         { diffs: commit.diffs, commitMessage: commit.message, languages: commit.languages, repo: commit.repo, sha: commit.sha },
         config.posting.analysis_top_n,
         modules,
         recentModuleIds,
       );
 
-      if (findings.length === 0) {
+      if (pipelineFindings.length === 0) {
         logger.info('poll.skip.no_findings', { sha: commit.sha });
         continue;
       }
 
-      // Generate post (ONE Claude call — returns full post + Twitter short variant)
-      const storedVoiceProfile = await storage.getVoiceProfile(commit.authorLogin ?? null);
-      const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
-      const authorLogin = commit.authorLogin ?? null;
-      const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
-      const voiceStage = computeVoiceStage(uniquePublished, (voiceProfile.bootstrap_posts?.length ?? 0) > 0);
-      const startOfDay = new Date();
-      startOfDay.setUTCHours(0, 0, 0, 0);
-      const draftsToday = authorLogin ? await storage.countDraftsSince(authorLogin, startOfDay.toISOString()) : 0;
-      const exposurePool = authorLogin && voiceStage !== 'cold'
-        ? await storage.getPublishedForExposure(authorLogin, 'linkedin')
-        : [];
-      const topModuleId = findings[0]?.moduleId;
-      const topModuleFireCount = topModuleId
-        ? recentModuleIds.filter((moduleId) => moduleId === topModuleId).length
-        : 0;
-      const chapterContext = topModuleId && topModuleFireCount >= 1
-        ? buildChapterContext(topModuleId, await storage.getRecentTopFindings(authorLogin, topModuleId, 2), topModuleFireCount + 1)
-        : undefined;
-      const todayFirstOpening = undefined;
-      const varietyConstraint = voiceStage !== 'cold'

--- src/voice/sqlite-storage.ts
diff --git a/src/voice/sqlite-storage.ts b/src/voice/sqlite-storage.ts
index 43fec1f..3cf289c 100644
--- a/src/voice/sqlite-storage.ts
+++ b/src/voice/sqlite-storage.ts
@@ -433,6 +433,17 @@ export class SqliteStorage implements IVoiceStorage {
     return Promise.resolve(rows.map(mapVoicePost));
   }
 
+  getDraftsSince(authorLogin: string, sinceIso: string): Promise<VoicePost[]> {
+    const rows = this.db.prepare(`
+      SELECT * FROM voice_posts
+      WHERE tenant_id = ?
+        AND author_login = ?
+        AND created_at >= ?
+      ORDER BY created_at ASC
+    `).all(this.tenantId, authorLogin, sinceIso) as SqliteVoicePostRow[];
+    return Promise.resolve(rows.map(mapVoicePost));
+  }
+
   countDraftsSince(authorLogin: string, sinceIso: string): Promise<number> {
     const row = this.db.prepare(`
       SELECT COUNT(*) AS count


--- src/voice/storage.ts
diff --git a/src/voice/storage.ts b/src/voice/storage.ts
index 2c23076..e1feb07 100644
--- a/src/voice/storage.ts
+++ b/src/voice/storage.ts
@@ -161,6 +161,9 @@ export interface IVoiceStorage {
   /** Get recent outcomes for one author across published/expired rows. */
   getRecentOutcomes(authorLogin: string, limit: number): Promise<VoicePost[]>;
 
+  /** Get drafts created after the provided ISO timestamp, ordered oldest-first. */
+  getDraftsSince(authorLogin: string, sinceIso: string): Promise<VoicePost[]>;
+
   /** Count drafts for one author created after the provided ISO timestamp. */
   countDraftsSince(authorLogin: string, sinceIso: string): Promise<number>;
 


--- src/voice/supabase-storage.ts
diff --git a/src/voice/supabase-storage.ts b/src/voice/supabase-storage.ts
index a4b7c87..fc32515 100644
--- a/src/voice/supabase-storage.ts
+++ b/src/voice/supabase-storage.ts
@@ -322,6 +322,19 @@ export class SupabaseStorage implements IVoiceStorage {
     return (data ?? []) as VoicePost[];
   }
 
+  async getDraftsSince(authorLogin: string, sinceIso: string): Promise<VoicePost[]> {
+    const { data, error } = await this.db
+      .from('voice_posts')
+      .select('*')
+      .eq('tenant_id', this.tenantId)
+      .eq('author_login', authorLogin)
+      .gte('created_at', sinceIso)
+      .order('created_at', { ascending: true });
+
+    if (error) throw new Error(`getDraftsSince failed: ${error.message}`);
+    return (data ?? []) as VoicePost[];
+  }
+
   async countDraftsSince(authorLogin: string, sinceIso: string): Promise<number> {
     const { count, error } = await this.db
       .from('voice_posts')


--- src/worker/daily-post-selection.ts
diff --git a/src/worker/daily-post-selection.ts b/src/worker/daily-post-selection.ts
new file mode 100644
index 0000000..5b84d14
--- /dev/null
+++ b/src/worker/daily-post-selection.ts
@@ -0,0 +1,184 @@
+import type { Finding } from '../analysis/types.js';
+import type { EnrichedCommit } from '../github/commit-enricher.js';
+import type { VoicePost } from '../voice/storage.js';
+
+const FINDING_WEIGHTS = [1, 0.45, 0.2] as const;
+const MAX_SIZE_BONUS = 0.35;
+const MULTI_FINDING_BONUS = 0.2;
+const SAME_DAY_MODULE_PENALTY = 0.72;
+const SATURATED_MODULE_PENALTY = 0.9;
+
+export interface RankedCommitCandidate {
+  readonly commitSha: string;
+  readonly committedAt: string;
+  readonly findingsCount: number;
+  readonly topModuleId?: string | null;
+  readonly topModuleFireCount: number;
+  readonly rankingScore: number;
+  readonly totalChangedLines: number;
+}
+
+export function buildModuleFireCounts(moduleIds: string[]): Map<string, number> {
+  const counts = new Map<string, number>();
+  for (const moduleId of moduleIds) {
+    counts.set(moduleId, (counts.get(moduleId) ?? 0) + 1);
+  }
+  return counts;
+}
+
+export function computeCandidateRankingScore(
+  commit: Pick<EnrichedCommit, 'totalAdditions' | 'totalDeletions'>,
+  findings: Finding[],
+  recentModuleFireCounts: ReadonlyMap<string, number>,
+): number {
+  const weightedFindings = findings
+    .slice(0, FINDING_WEIGHTS.length)
+    .reduce((sum, finding, index) => {
+      const weight = FINDING_WEIGHTS[index] ?? 0;
+      return sum + (adjustFindingScore(finding, recentModuleFireCounts) * weight);
+    }, 0);
+
+  const breadthBonus = Math.max(0, findings.length - 1) * MULTI_FINDING_BONUS;
+  const changedLines = commit.totalAdditions + commit.totalDeletions;
+  const sizeBonus = Math.min(changedLines, 400) / 400 * MAX_SIZE_BONUS;
+
+  return Number((weightedFindings + breadthBonus + sizeBonus).toFixed(4));
+}
+
+export function selectTopDailyCandidates<T extends RankedCommitCandidate>(
+  candidates: T[],
+  existingTodayDrafts: Array<Pick<VoicePost, 'top_module_id'>>,
+  slotsAvailable: number,
+): T[] {
+  if (slotsAvailable <= 0 || candidates.length === 0) return [];
+
+  const selected: T[] = [];
+  const remaining = [...candidates];
+  const moduleUsage = new Map<string, number>();
+
+  for (const draft of existingTodayDrafts) {
+    const topModuleId = draft.top_module_id;
+    if (!topModuleId) continue;
+    moduleUsage.set(topModuleId, (moduleUsage.get(topModuleId) ?? 0) + 1);
+  }
+
+  while (selected.length < slotsAvailable && remaining.length > 0) {
+    let bestIndex = 0;
+    let bestScore = computeSelectionScore(
+      remaining[0]!,
+      moduleUsage,
+      existingTodayDrafts.length + selected.length,
+    );
+
+    for (let i = 1; i < remaining.length; i++) {
+      const candidate = remaining[i]!;
+      const score = computeSelectionScore(candidate, moduleUsage, existingTodayDrafts.length + selected.length);
+      if (isBetterCandidate(candidate, score, remaining[bestIndex]!, bestScore)) {
+        bestIndex = i;
+        bestScore = score;
+      }
+    }
+
+    const [bestCandidate] = remaining.splice(bestIndex, 1);
+    if (!bestCandidate) break;
+    selected.push(bestCandidate);
+
+    if (bestCandidate.topModuleId) {
+      moduleUsage.set(bestCandidate.topModuleId, (moduleUsage.get(bestCandidate.topModuleId) ?? 0) + 1);
+    }
+  }
+
+  return selected;
+}
+
+export function getStartOfDayIso(timeZone: string, reference = new Date()): string {
+  const dateParts = getTimeZoneDateParts(reference, timeZone);
+  const utcGuess = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0));
+  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
+  return new Date(utcGuess.getTime() - offsetMs).toISOString();
+}
+
+function adjustFindingScore(
+  finding: Finding,
+  recentModuleFireCounts: ReadonlyMap<string, number>,
+): number {
+  const fireCount = recentModuleFireCounts.get(finding.moduleId) ?? 0;
+  return finding.interestScore / (fireCount + 1);
+}
+
+function computeSelectionScore<T extends RankedCommitCandidate>(
+  candidate: T,
+  moduleUsage: ReadonlyMap<string, number>,
+  postsAlreadyPlannedToday: number,
+): number {
+  let score = candidate.rankingScore;
+
+  if (postsAlreadyPlannedToday > 0 && candidate.topModuleFireCount >= 2) {
+    score *= SATURATED_MODULE_PENALTY;
+  }
+
+  if (candidate.topModuleId) {
+    const repeatedToday = moduleUsage.get(candidate.topModuleId) ?? 0;
+    if (repeatedToday > 0) {
+      score *= SAME_DAY_MODULE_PENALTY ** repeatedToday;
+    }
+  }
+
+  return score;
+}
+
+function isBetterCandidate<T extends RankedCommitCandidate>(
+  left: T,
+  leftScore: number,
+  right: T,
+  rightScore: number,
+): boolean {
+  if (leftScore !== rightScore) return leftScore > rightScore;
+  if (left.rankingScore !== right.rankingScore) return left.rankingScore > right.rankingScore;
+  if (left.findingsCount !== right.findingsCount) return left.findingsCount > right.findingsCount;
+  if (left.totalChangedLines !== right.totalChangedLines) return left.totalChangedLines > right.totalChangedLines;
+  return new Date(left.committedAt).getTime() > new Date(right.committedAt).getTime();
+}
+
+function getTimeZoneDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
+  const formatter = new Intl.DateTimeFormat('en-CA', {

--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 29fc202..417d350 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -1,9 +1,10 @@
 import type { SupabaseClient } from '@supabase/supabase-js';
 import { GitHubClient } from '../github/client.js';
 import { LinkedInClient, LinkedInAuthExpiredError } from '../linkedin/client.js';
-import { enrichCommit } from '../github/commit-enricher.js';
+import { enrichCommit, type EnrichedCommit } from '../github/commit-enricher.js';
 import { isInteresting } from '../utils/commit-filter.js';
 import { runPipeline } from '../analysis/pipeline.js';
+import type { Finding } from '../analysis/types.js';
 import { MODULE_REGISTRY } from '../analysis/modules/index.js';
 import { createAIClient, createEmbedder } from '../ai/factory.js';
 import { generatePosts } from '../ai/post-generator.js';
@@ -16,11 +17,18 @@ import { SupabaseStorage } from '../voice/supabase-storage.js';
 import { getInstallationToken } from './github-app-auth.js';
 import { logger } from '../utils/logger.js';
 import { ConfigSchema } from '../config/schema.js';
-import type { Config } from '../config/schema.js';
-import type { SaveDraftInput } from '../voice/storage.js';
+import type { Config, VoiceProfile } from '../config/schema.js';
+import type { SaveDraftInput, VoicePost, VoiceStage } from '../voice/storage.js';
 import { resolveTenantSecrets } from '../security/tenant-secrets.js';
 import { filterFindingsByContentStrategy, matchesSkipPatterns, mergeVoiceProfile } from '../voice/profile-utils.js';
 import { computeVoiceStage } from '../voice/stage.js';
+import {
+  buildModuleFireCounts,
+  computeCandidateRankingScore,
+  getStartOfDayIso,
+  selectTopDailyCandidates,
+  type RankedCommitCandidate,
+} from './daily-post-selection.js';
 
 interface TenantRow {
   readonly id: string;
@@ -52,6 +60,27 @@ export interface ProcessJobDeps {
   readonly openaiApiKey?: string;
 }
 
+const MATCHER_MAX_TOKENS = 400;
+
+type TodayDraftState = Pick<VoicePost, 'created_at' | 'opening_move' | 'top_module_id'>;
+
+interface AuthorGenerationState {
+  readonly authorLogin: string | null;
+  readonly voiceProfile: VoiceProfile;
+  readonly hasBootstrap: boolean;
+  uniquePublished: number;
+  voiceStage: VoiceStage;
+  todayDrafts: TodayDraftState[];
+}
+
+interface CommitCandidate extends RankedCommitCandidate {
+  readonly commit: EnrichedCommit;
+  readonly findings: Finding[];
+  readonly authorKey: string;
+  readonly authorLogin: string | null;
+  readonly voiceProfile: VoiceProfile;
+}
+
 /**
  * Builds a Config from a tenant row + its config JSONB.
  * Uses 'UNCONFIGURED' as placeholder for buffer.organization_id when absent
@@ -136,13 +165,49 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
   );
 
   const github = new GitHubClient(installationToken);
-  const anthropic = createAIClient('anthropic', deps.anthropicApiKey, config.ai.model, config.ai.max_tokens);
+  const generationAi = createAIClient('anthropic', deps.anthropicApiKey, config.ai.model, config.ai.max_tokens);
+  const matcherAi = createAIClient('anthropic', deps.anthropicApiKey, config.ai.classify_model, MATCHER_MAX_TOKENS);
   const storage = new SupabaseStorage(deps.supabaseUrl, deps.supabaseServiceKey, tenant.id);
   const embedder = deps.openaiApiKey
     ? createEmbedder(config.embeddings.provider, deps.openaiApiKey, config.embeddings.model)
     : null;
 
   const [owner, repo] = job.repo.split('/') as [string, string];
+  const recentModuleIds = await storage.getRecentModuleIds(30);
+  const recentModuleFireCounts = buildModuleFireCounts(recentModuleIds);
+  const dayStartIso = getStartOfDayIso(config.scheduling.timezone);
+  const dailyLimit = config.posting.max_daily_posts_per_author;
+  const authorStates = new Map<string, AuthorGenerationState>();
+  const candidatesByAuthor = new Map<string, CommitCandidate[]>();
+
+  const getAuthorState = async (authorLogin: string | null, commitSha: string): Promise<{
+    authorKey: string;
+    state: AuthorGenerationState;
+  }> => {
+    const authorKey = authorLogin ?? `unknown:${commitSha}`;
+    const existing = authorStates.get(authorKey);
+    if (existing) return { authorKey, state: existing };
+
+    const storedVoiceProfile = await storage.getVoiceProfile(authorLogin);
+    const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
+    const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
+    const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
+    const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);
+    const todayDrafts = authorLogin
+      ? (await storage.getDraftsSince(authorLogin, dayStartIso)).map(toTodayDraftState)
+      : [];
+
+    const state: AuthorGenerationState = {
+      authorLogin,
+      voiceProfile,
+      hasBootstrap,
+      uniquePublished,
+      voiceStage,
+      todayDrafts,
+    };
+    authorStates.set(authorKey, state);
+    return { authorKey, state };
+  };
 
   // Get the list of commits in this push range
   const commits = await github.compareCommits(owner, repo, job.before_sha, job.after_sha);
@@ -184,7 +249,17 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
         continue;
       }
 
-      const recentModuleIds = await storage.getRecentModuleIds(30);
+      const { authorKey, state: authorState } = await getAuthorState(commit.authorLogin ?? null, commit.sha);
+      if (authorState.authorLogin && authorState.todayDrafts.length >= dailyLimit) {
+        logger.info('worker.commit.skip.daily_limit_reached', {
+          sha: commit.sha,
+          authorLogin: authorState.authorLogin,
+          draftsToday: authorState.todayDrafts.length,
+          dailyLimit,
+        });
+        continue;
+      }
+
       const pipelineFindings = await runPipeline(
         {
           diffs: commit.diffs,
@@ -203,221 +278,296 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
         continue;
       }
 
-      const storedVoiceProfile = await storage.getVoiceProfile(commit.authorLogin ?? null);
-      const voiceProfile = mergeVoiceProfile(storedVoiceProfile?.voice);
-      const authorLogin = commit.authorLogin ?? null;
-      const uniquePublished = authorLogin ? await storage.countUniquePublished(authorLogin) : 0;
-      const hasBootstrap = (voiceProfile.bootstrap_posts?.length ?? 0) > 0;
-      const voiceStage = computeVoiceStage(uniquePublished, hasBootstrap);
-      const startOfDay = new Date();
-      startOfDay.setUTCHours(0, 0, 0, 0);
-      const todayStartIso = startOfDay.toISOString();
-      const draftsToday = authorLogin ? await storage.countDraftsSince(authorLogin, todayStartIso) : 0;
-      const findings = filterFindingsByContentStrategy(pipelineFindings, voiceProfile);
```

### Commit 6: a884538
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

### Commit 7: a9507ed
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

### Commit 8: afa2650
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

### Commit 9: da0b16c
**Message:** feat: harden article matching and add audit mode

**Diff:**
```diff
--- docs/article-match-hardening-spec.md
diff --git a/docs/article-match-hardening-spec.md b/docs/article-match-hardening-spec.md
new file mode 100644
index 0000000..6cae26c
--- /dev/null
+++ b/docs/article-match-hardening-spec.md
@@ -0,0 +1,566 @@
+# Article Match Hardening Spec
+
+Status: Draft
+Date: 2026-04-11
+Owner: devcast
+
+## Problem
+
+The content-matching system is working end to end, but it is under-matching strong commits.
+
+Observed behavior:
+
+- interesting commits are successfully analyzed and ranked
+- the article matcher usually returns `no_match`
+- no historical `voice_posts` rows currently contain `context_status`
+- representative commits with strong findings still fail retrieval
+
+The issue is not a single bug. It is a system design mismatch across:
+
+1. commit analysis output
+2. retrieval query construction
+3. retrieval calibration
+4. corpus freshness
+5. match timing
+
+## What We Learned From The Code
+
+### 1. KMS commits are not described as security work
+
+The `security` module only recognizes:
+
+- hardcoded secrets
+- SQL injection
+- input validation
+- auth/authz
+- security headers
+
+Source: [security.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/security.ts)
+
+It does not recognize:
+
+- KMS
+- envelope encryption
+- key wrapping / unwrapping
+- DEK / KEK patterns
+- AES-GCM token sealing
+- secret storage boundary hardening
+
+So the KMS commit is free to be claimed by other modules first:
+
+- `integration` sees `@supabase/supabase-js` or generic client setup and emits a generic integration finding
+- `dependency_health` sees `@google-cloud/kms` and emits `new dependency added`
+- `type_system` sees utility types / type guards and emits a generic type-system finding
+
+Source: [integration.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/integration.ts), [dependency-health.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/dependency-health.ts), [type-system.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/type-system.ts)
+
+### 2. Progressive voice is being described as extraction + config validation
+
+The `evolutionary` module heavily rewards module extraction:
+
+- any added file with >= 30 lines
+- any modified file with >= 30 deletions
+- same directory or same extension
+
+That is enough for large refactors and doc/spec extraction work to be labeled as `module extraction`.
+
+Source: [evolutionary.ts](/Users/Lilicurl/Documents/git/social-engagement/src/analysis/modules/evolutionary.ts)
+
+The same commit also modified `src/config/schema.ts`, so both `security` and `dx` detected schema validation.
+
+This produced findings that are valid, but incomplete:
+
+- they describe visible structural moves
+- they do not capture the central narrative of the commit
+- they are weak retrieval queries for industry context
+
+### 3. The match query is too abstract
+
+Today Stage 1 embeds only `finding.plainLanguage`.
+
+Source: [matcher.ts](/Users/Lilicurl/Documents/git/social-engagement/src/content/matcher.ts)
+
+That is a problem because `plainLanguage` is optimized for social explanation, not semantic retrieval.
+
+Examples:
+
+- `Extracting code into its own module is a sign of a codebase maturing`
+- `Validating input at the boundary catches bad data early`
+
+These are good post-writing sentences.
+They are bad retrieval queries because they lose critical terms:
+
+- `KMS`
+- `envelope encryption`
+- `tenant token`
+- `AES-256-GCM`
+- `DEK`
+- `wrap/unwrap`
+- `voice system`
+- `progressive voice`
+- `opening_move`
+- `exposure examples`
+
+### 4. Retrieval is calibrated too aggressively
+
+Today the worker uses:
+
+- `0.75` similarity by default
+- `0.72` when the voice profile prefers industry context
+
+Source: [process-job.ts](/Users/Lilicurl/Documents/git/social-engagement/src/worker/process-job.ts)
+
+But manual inspection of representative findings showed top similarities like:
+
+- voice-system style finding: ~`0.42`
+- observability style finding: ~`0.44`
+- KMS/security style finding: ~`0.34`
+
+So Stage 1 is rejecting most reasonable candidates before Stage 2 can judge them.
+
+### 5. The corpus is varied, but not fresh
+
+The stored corpus is not empty and not monolithic by topic.
+It includes coverage for performance, evolutionary, dx, security, architecture, observability, AI, and more.
+
+But operationally it is still mostly static:
+
+- `content_items`: 200
+- `article_chunks`: 587
+- only one active source: `curated-seed`
+- most sources remain `queued`
+
+The seed corpus is intentionally stored with:
+
+- `DEFAULT_SEED_WEEK_OF = 2026-01-01`
+
+Source: [shared.ts](/Users/Lilicurl/Documents/git/social-engagement/scripts/seed-corpus/shared.ts)
+
+The SQL matcher allows seed articles to bypass freshness cutoff because `is_protected = true`.
+
+Source: [schema.sql](/Users/Lilicurl/Documents/git/social-engagement/database/schema.sql)
+
+That means the system currently matches mostly against a frozen anchor corpus, not a living stream of recent engineering writing.
+

--- package.json
diff --git a/package.json b/package.json
index 6457090..735ea0d 100644
--- a/package.json
+++ b/package.json
@@ -10,6 +10,7 @@
     "bootstrap": "tsx --env-file=.env.local scripts/bootstrap-voice.ts",
     "voice:analyze": "tsx --env-file=.env.local scripts/analyze-voice.ts",
     "voice:validate-registry": "tsx --env-file=.env.local scripts/validate-registry.ts",
+    "audit:match": "tsx --env-file=.env.local scripts/audit-content-match.ts",
     "test-analyze": "tsx --env-file=.env.local scripts/test-analyze.ts",
     "webhook": "tsx --env-file=.env.local src/webhook/server.ts",
     "worker": "tsx --env-file=.env.local src/worker/main-worker.ts",


--- scripts/audit-content-match.ts
diff --git a/scripts/audit-content-match.ts b/scripts/audit-content-match.ts
new file mode 100644
index 0000000..2ea9337
--- /dev/null
+++ b/scripts/audit-content-match.ts
@@ -0,0 +1,335 @@
+import { createClient, type SupabaseClient } from '@supabase/supabase-js';
+import { createAIClient, createEmbedder } from '../src/ai/factory.js';
+import { runPipeline } from '../src/analysis/pipeline.js';
+import type { Finding } from '../src/analysis/types.js';
+import { matchFindingsToArticles } from '../src/content/matcher.js';
+import { enrichCommit } from '../src/github/commit-enricher.js';
+import { GitHubClient } from '../src/github/client.js';
+import { getInstallationToken } from '../src/worker/github-app-auth.js';
+
+type AuditMode = 'commit' | 'draft' | 'published';
+
+interface TenantRow {
+  readonly id: string;
+  readonly github_username: string;
+  readonly github_installation_id: number;
+  readonly config: Record<string, unknown> | null;
+}
+
+interface AuditPostRow {
+  readonly id: string;
+  readonly commit_sha: string;
+  readonly repo: string;
+  readonly ai_draft: string;
+  readonly published: string | null;
+  readonly created_at: string;
+  readonly published_at: string | null;
+  readonly status: string;
+  readonly top_finding: string | null;
+  readonly top_module_id: string | null;
+  readonly author_login: string | null;
+}
+
+interface AuditResult {
+  readonly mode: AuditMode;
+  readonly sourceId: string;
+  readonly repo: string;
+  readonly commitSha: string;
+  readonly authorLogin: string | null;
+  readonly timestamp: string | null;
+  readonly findingHeadline: string;
+  readonly matched: boolean;
+  readonly matchedArticleTitle: string | null;
+  readonly matchStrength: number | null;
+  readonly connection: string | null;
+  readonly textPreview: string;
+}
+
+function getArg(name: string): string | undefined {
+  const idx = process.argv.indexOf(name);
+  return idx >= 0 ? process.argv[idx + 1] : undefined;
+}
+
+function getRequiredEnv(name: string): string {
+  const value = process.env[name];
+  if (!value) throw new Error(`${name} is required.`);
+  return value;
+}
+
+function getTenantId(): string {
+  return getArg('--tenant') ?? process.env['TENANT_ID'] ?? '';
+}
+
+function getMode(): AuditMode {
+  const mode = (getArg('--mode') ?? 'published') as AuditMode;
+  if (mode !== 'commit' && mode !== 'draft' && mode !== 'published') {
+    throw new Error(`Unsupported mode "${mode}". Use commit, draft, or published.`);
+  }
+  return mode;
+}
+
+function getLimit(): number {
+  const raw = getArg('--limit');
+  if (!raw) return 10;
+  const parsed = Number(raw);
+  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('--limit must be a positive number.');
+  return parsed;
+}
+
+function getStringConfig(
+  config: Record<string, unknown> | null,
+  section: string,
+  key: string,
+  fallback: string,
+): string {
+  const parent = config?.[section];
+  if (!parent || typeof parent !== 'object') return fallback;
+  const value = (parent as Record<string, unknown>)[key];
+  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
+}
+
+function trimPreview(text: string, maxLength = 180): string {
+  const normalized = text.replace(/\s+/g, ' ').trim();
+  if (normalized.length <= maxLength) return normalized;
+  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
+}
+
+function tokenizeText(value: string): string[] {
+  return [...new Set(value
+    .toLowerCase()
+    .split(/[^a-z0-9]+/)
+    .map((part) => part.trim())
+    .filter((part) => part.length >= 3 && part.length <= 30)
+  )].slice(0, 16);
+}
+
+function getPostText(post: AuditPostRow, mode: AuditMode): string {
+  if (mode === 'published') return post.published ?? '';
+  return post.ai_draft ?? '';
+}
+
+function buildAuditFindingFromPost(post: AuditPostRow, mode: AuditMode): Finding {
+  const text = getPostText(post, mode);
+  const headline = post.top_finding ?? `${mode} post for ${post.repo}`;
+  const retrievalTerms = [
+    ...tokenizeText(post.repo),
+    ...tokenizeText(post.top_module_id ?? ''),
+    ...tokenizeText(post.top_finding ?? ''),
+  ].slice(0, 18);
+
+  return {
+    moduleId: post.top_module_id ?? `${mode}_post`,
+    aspect: `${mode} post audit`,
+    finding: headline,
+    technicalDetail: `Post audit for ${post.repo} commit ${post.commit_sha}. Original status: ${post.status}.`,
+    plainLanguage: text,
+    interestScore: 10,
+    contextHint: `${mode} post ${post.id}`,
+    retrievalTerms,
+    retrievalText: [
+      `Audit mode: ${mode}`,
+      `Repository: ${post.repo}`,
+      `Commit SHA: ${post.commit_sha}`,
+      `Top module: ${post.top_module_id ?? 'unknown'}`,
+      `Top finding: ${headline}`,
+      `Post text: ${text}`,
+    ].join('\n'),
+  };
+}
+
+async function loadTenant(db: SupabaseClient, tenantId: string): Promise<TenantRow> {
+  const { data, error } = await db
+    .from('tenants')
+    .select('id, github_username, github_installation_id, config')
+    .eq('id', tenantId)

--- scripts/test-analyze.ts
diff --git a/scripts/test-analyze.ts b/scripts/test-analyze.ts
index 5246a0e..6238fbf 100644
--- a/scripts/test-analyze.ts
+++ b/scripts/test-analyze.ts
@@ -44,6 +44,7 @@ async function main(): Promise<void> {
   const findings = await runPipeline({
     diffs: commit.diffs,
     commitMessage: commit.message,
+    commitBody: commit.body,
     languages: commit.languages,
     repo: commit.repo,
     sha: commit.sha,
@@ -62,6 +63,8 @@ async function main(): Promise<void> {
     console.log(`  Finding:   ${finding.finding}`);
     console.log(`  Technical: ${finding.technicalDetail}`);
     console.log(`  Plain:     ${finding.plainLanguage.slice(0, 120)}...`);
+    if (finding.retrievalText) console.log(`  Retrieval: ${finding.retrievalText.slice(0, 160)}...`);
+    if (finding.retrievalTerms?.length) console.log(`  Terms:     ${finding.retrievalTerms.join(', ')}`);
     if (finding.evidence) {
       if (finding.evidence.before) console.log(`  Before:    ${finding.evidence.before}`);
       if (finding.evidence.after)  console.log(`  After:     ${finding.evidence.after}`);


--- src/analysis/modules/evolutionary.ts
diff --git a/src/analysis/modules/evolutionary.ts b/src/analysis/modules/evolutionary.ts
index b4c060e..0a16ae1 100644
--- a/src/analysis/modules/evolutionary.ts
+++ b/src/analysis/modules/evolutionary.ts
@@ -14,9 +14,17 @@ function getDirectory(filename: string): string {
   return slash === -1 ? '' : filename.slice(0, slash);
 }
 
-function detectModuleExtraction(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const addedFiles = diffs.filter((d) => d.status === 'added' && d.additions >= MIN_EXTRACTION_LINES);
-  const modifiedWithDeletions = diffs.filter((d) => d.status === 'modified' && d.deletions >= MIN_EXTRACTION_LINES);
+function getRetrievalTerms(...values: string[]): string[] {
+  return [...new Set(values
+    .flatMap((value) => value.split(/[^A-Za-z0-9]+/))
+    .map((part) => part.trim().toLowerCase())
+    .filter((part) => part.length >= 3 && part.length <= 30)
+  )].slice(0, 12);
+}
+
+function detectModuleExtraction(ctx: AnalysisContext): Finding | null {
+  const addedFiles = ctx.diffs.filter((d) => d.status === 'added' && d.additions >= MIN_EXTRACTION_LINES);
+  const modifiedWithDeletions = ctx.diffs.filter((d) => d.status === 'modified' && d.deletions >= MIN_EXTRACTION_LINES);
 
   for (const added of addedFiles) {
     for (const modified of modifiedWithDeletions) {
@@ -26,11 +34,12 @@ function detectModuleExtraction(diffs: readonly FileDiff[], repo: string): Findi
         return {
           moduleId: 'evolutionary',
           aspect: 'module extraction',
-          finding: `module extraction: ${modified.filename} -> ${added.filename}`,
-          technicalDetail: 'Module extraction — splitting a large file into smaller, focused modules with single responsibilities.',
-          plainLanguage: 'Extracting code into its own module is a sign of a codebase maturing. A file that does too much gets split into focused pieces — each easier to test, read, and change independently.',
+          finding: `module extraction: responsibilities moved from ${modified.filename} into ${added.filename}`,
+          technicalDetail: `Module extraction — splitting responsibilities from ${modified.filename} into ${added.filename} to create a smaller, more focused boundary.`,
+          plainLanguage: 'Extracting code into its own module is a sign of a codebase maturing. A file that does too much gets split into focused pieces so each one is easier to test, reason about, and evolve independently.',
           interestScore: 9,
-          contextHint: `${added.filename} in ${repo}`,
+          contextHint: `${added.filename} in ${ctx.repo}`,
+          retrievalTerms: getRetrievalTerms('module extraction', modified.filename, added.filename, ctx.commitMessage),
         };
       }
     }
@@ -39,8 +48,8 @@ function detectModuleExtraction(diffs: readonly FileDiff[], repo: string): Findi
   return null;
 }
 
-function detectFileRename(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const renamed = diffs.find((d) => d.status === 'renamed');
+function detectFileRename(ctx: AnalysisContext): Finding | null {
+  const renamed = ctx.diffs.find((d) => d.status === 'renamed');
   if (!renamed) return null;
   return {
     moduleId: 'evolutionary',
@@ -49,12 +58,13 @@ function detectFileRename(diffs: readonly FileDiff[], repo: string): Finding | n
     technicalDetail: 'File rename — improving naming to better reflect the module\'s responsibility and make the codebase more navigable.',
     plainLanguage: 'Renaming a file signals that the team is investing in clarity. Good names reduce the time it takes a new developer to find what they are looking for.',
     interestScore: 5,
-    contextHint: `${renamed.filename} in ${repo}`,
+    contextHint: `${renamed.filename} in ${ctx.repo}`,
+    retrievalTerms: getRetrievalTerms('file rename', renamed.filename, ctx.commitMessage),
   };
 }
 
-function detectMigration(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const migration = diffs.find((d) => d.status === 'added' && MIGRATION_REGEX.test(d.filename));
+function detectMigration(ctx: AnalysisContext): Finding | null {
+  const migration = ctx.diffs.find((d) => d.status === 'added' && MIGRATION_REGEX.test(d.filename));
   if (!migration) return null;
   return {
     moduleId: 'evolutionary',
@@ -63,12 +73,13 @@ function detectMigration(diffs: readonly FileDiff[], repo: string): Finding | nu
     technicalDetail: 'Database migration — a versioned schema change that evolves the database structure alongside application code.',
     plainLanguage: 'Migrations keep the database in sync with the code. Each migration is a reversible step — if something breaks, you roll back one version, not the entire schema.',
     interestScore: 8,
-    contextHint: `${migration.filename} in ${repo}`,
+    contextHint: `${migration.filename} in ${ctx.repo}`,
+    retrievalTerms: getRetrievalTerms('database migration', migration.filename, ctx.commitMessage),
   };
 }
 
-function detectDeprecation(diffs: readonly FileDiff[], repo: string): Finding | null {
-  for (const diff of diffs) {
+function detectDeprecation(ctx: AnalysisContext): Finding | null {
+  for (const diff of ctx.diffs) {
     if (!diff.patch || diff.status === 'removed') continue;
     const addedLines = diff.patch
       .split('\n')
@@ -83,15 +94,16 @@ function detectDeprecation(diffs: readonly FileDiff[], repo: string): Finding |
         technicalDetail: 'Deprecation — marking code as obsolete with a clear signal to stop using it before it is removed.',
         plainLanguage: 'Deprecation warnings give consumers time to migrate. Instead of a breaking removal, you mark it deprecated, document the replacement, and remove it in the next major version.',
         interestScore: 7,
-        contextHint: `${diff.filename} in ${repo}`,
+        contextHint: `${diff.filename} in ${ctx.repo}`,
+        retrievalTerms: getRetrievalTerms('deprecation', diff.filename, ctx.commitMessage),
       };
     }
   }
   return null;
 }
 
-function detectLargeDeletion(diffs: readonly FileDiff[], repo: string): Finding | null {
-  const large = diffs.find((d) => d.status === 'modified' && d.deletions >= MIN_LARGE_DELETION);
+function detectLargeDeletion(ctx: AnalysisContext): Finding | null {
+  const large = ctx.diffs.find((d) => d.status === 'modified' && d.deletions >= MIN_LARGE_DELETION);
   if (!large) return null;
   return {
     moduleId: 'evolutionary',
@@ -100,7 +112,8 @@ function detectLargeDeletion(diffs: readonly FileDiff[], repo: string): Finding
     technicalDetail: 'Large-scale deletion — significant code removal indicating simplification, dead code cleanup, or responsibility transfer.',
     plainLanguage: 'Deleting code is underrated. Every line removed is a line that no longer needs tests, reviews, or maintenance. The best refactor often makes the codebase smaller, not bigger.',
     interestScore: 7,
-    contextHint: `${large.filename} in ${repo}`,
+    contextHint: `${large.filename} in ${ctx.repo}`,
+    retrievalTerms: getRetrievalTerms('simplification', large.filename, ctx.commitMessage),
   };
 }
 
@@ -110,10 +123,10 @@ export class EvolutionaryModule implements CodeAnalyzer {
   readonly category = 'evolutionary' as const;
 
   async analyze(ctx: AnalysisContext): Promise<Finding | null> {
-    return detectModuleExtraction(ctx.diffs, ctx.repo)
-      ?? detectFileRename(ctx.diffs, ctx.repo)
-      ?? detectMigration(ctx.diffs, ctx.repo)
-      ?? detectDeprecation(ctx.diffs, ctx.repo)
-      ?? detectLargeDeletion(ctx.diffs, ctx.repo);
+    return detectModuleExtraction(ctx)
+      ?? detectFileRename(ctx)
+      ?? detectMigration(ctx)
+      ?? detectDeprecation(ctx)
+      ?? detectLargeDeletion(ctx);
   }
 }


--- src/analysis/modules/integration.ts
diff --git a/src/analysis/modules/integration.ts b/src/analysis/modules/integration.ts
index 55276dd..e6d96ed 100644
--- a/src/analysis/modules/integration.ts
+++ b/src/analysis/modules/integration.ts
@@ -6,18 +6,28 @@ interface ServiceSignature {
   category: string;
   explanation: string;
   score: number;
+  retrievalTerms?: string[];
 }
 
 // AI integrations are covered by AiAssistedModule — skip here to avoid duplicate findings
 const AI_CATEGORY = 'AI / large language model';
 
 const KNOWN_SERVICES: ServiceSignature[] = [
+  {
+    name: 'Google Cloud KMS',
+    patterns: [/from ['"]@google-cloud\/kms['"]|KeyManagementServiceClient\(/i],
+    category: 'cloud key management',
+    explanation: 'KMS integration moves encryption boundaries into a managed key service. The important design work is around envelope encryption, tenant isolation, key rotation, and how secrets are decrypted only at the last responsible moment.',
+    score: 9,
+    retrievalTerms: ['google cloud kms', 'envelope encryption', 'dek', 'kek', 'tenant secrets'],
+  },
   {
     name: 'Redis',
-    patterns: [/from ['"]ioredis['"]|from ['"]redis['"]|new Redis\(|createClient\(\)/i],
+    patterns: [/from ['"]ioredis['"]|from ['"]redis['"]|new Redis\(|redis:\/\/|upstash/i],
     category: 'caching / pub-sub',
     explanation: 'Redis integration adds a fast in-memory layer between the application and the database. Key decisions: TTL strategy, fallback behavior on cache miss, and cache invalidation approach.',
     score: 9,
+    retrievalTerms: ['redis', 'cache invalidation', 'pub sub', 'ttl'],
   },
   {
     name: 'Stripe',
@@ -35,10 +45,11 @@ const KNOWN_SERVICES: ServiceSignature[] = [
   },
   {
     name: 'Supabase',
-    patterns: [/from ['"]@supabase\/supabase-js['"]|createClient\(/],
+    patterns: [/from ['"]@supabase\/supabase-js['"]|supabaseUrl|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/i],
     category: 'database / auth / storage',
     explanation: 'Supabase integration provides a Postgres-backed backend with built-in auth and row-level security. Connection setup and query patterns matter for both security and performance.',
     score: 7,
+    retrievalTerms: ['supabase', 'postgres', 'row level security', 'tenant storage'],
   },
   {
     name: 'Prisma',
@@ -103,6 +114,7 @@ export class IntegrationModule implements CodeAnalyzer {
     for (const service of KNOWN_SERVICES) {
       if (service.category === AI_CATEGORY) continue;
       if (service.patterns.some(p => p.test(addedText))) {
+        const matchingDiff = ctx.diffs.find((diff) => service.patterns.some((pattern) => pattern.test(diff.patch)));
         return {
           moduleId: this.id,
           aspect: `${service.name} integration`,
@@ -110,7 +122,8 @@ export class IntegrationModule implements CodeAnalyzer {
           technicalDetail: `${service.name}, ${service.category}. New import/client initialization detected in the diff.`,
           plainLanguage: service.explanation,
           interestScore: service.score,
-          contextHint: `${ctx.diffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
+          contextHint: `${matchingDiff?.filename ?? ctx.diffs[0]?.filename ?? 'unknown'} in ${ctx.repo}`,
+          retrievalTerms: service.retrievalTerms,
         };
       }
     }


--- src/analysis/modules/security.ts
diff --git a/src/analysis/modules/security.ts b/src/analysis/modules/security.ts
index 495a9cb..b925bb1 100644
--- a/src/analysis/modules/security.ts
+++ b/src/analysis/modules/security.ts
@@ -6,14 +6,28 @@ interface SecurityPattern {
   readonly technicalDetail: string;
   readonly explanation: string;
   readonly isConcern: boolean;
+  readonly retrievalTerms?: readonly string[];
   detect(addedLines: readonly string[], filename: string): boolean;
 }
 
 const SECRET_REGEX = /(?:api[_-]?key|secret|token|password|credentials)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/i;
 const SQL_CONCAT_REGEX = /(?:`SELECT|`INSERT|`UPDATE|`DELETE|`DROP).*\$\{|['"]SELECT.*['"]\s*\+|['"]INSERT.*['"]\s*\+/i;
+const KMS_ENCRYPTION_REGEX = /@google-cloud\/kms|KeyManagementServiceClient|encrypted_dek|envelope encryption|createCipheriv|createDecipheriv|aes-256-gcm|getAuthTag|setAuthTag|kmsKeyName|resolveTenantSecrets|wrap(ped)? key|unwrap/i;
 const TEST_FILE_REGEX = /\.(test|spec)\.(ts|tsx|js|jsx)$|__tests__\//;
 
 const PATTERNS: readonly SecurityPattern[] = [
+  {
+    name: 'key management / envelope encryption',
+    score: 9,
+    isConcern: false,
+    technicalDetail: 'Envelope encryption with KMS-backed key management — a KEK protects tenant-scoped DEKs, while local AES-GCM handles the actual payload encryption.',
+    explanation: 'This is a serious security hardening step. Instead of leaving sensitive tokens in plaintext or relying on one shared secret, the system wraps per-tenant keys with a managed KMS boundary and decrypts data only when needed.',
+    retrievalTerms: ['kms', 'envelope encryption', 'dek', 'kek', 'aes-256-gcm', 'tenant secrets'],
+    detect: (lines, filename) => {
+      if (TEST_FILE_REGEX.test(filename)) return false;
+      return lines.some((line) => KMS_ENCRYPTION_REGEX.test(line));
+    },
+  },
   {
     name: 'hardcoded secret',
     score: 9,
@@ -95,6 +109,7 @@ export class SecurityModule implements CodeAnalyzer {
             plainLanguage: pattern.explanation,
             interestScore: pattern.score,
             contextHint: `${diff.filename} in ${ctx.repo}`,
+            retrievalTerms: pattern.retrievalTerms ? [...pattern.retrievalTerms] : undefined,
           };
         }
       }


--- src/analysis/pipeline.ts
diff --git a/src/analysis/pipeline.ts b/src/analysis/pipeline.ts
index 03adde2..f42df0e 100644
--- a/src/analysis/pipeline.ts
+++ b/src/analysis/pipeline.ts
@@ -1,6 +1,7 @@
 import { logger } from '../utils/logger.js';
 import { MODULE_REGISTRY } from './modules/index.js';
 import type { AnalysisContext, Finding, CodeAnalyzer } from './types.js';
+import { enrichFindingsForRetrieval } from './retrieval-enrichment.js';
 
 /**
  * Runs all applicable modules in parallel and returns the top N findings
@@ -62,7 +63,8 @@ export async function runPipeline(
   }
 
   const MIN_INTEREST_SCORE = 5;
-  const sorted = findings
+  const enrichedFindings = enrichFindingsForRetrieval(findings, ctx);
+  const sorted = enrichedFindings
     .filter((f) => f.interestScore >= MIN_INTEREST_SCORE)
     .map((f) => ({
       finding: f,


--- src/analysis/retrieval-enrichment.ts
diff --git a/src/analysis/retrieval-enrichment.ts b/src/analysis/retrieval-enrichment.ts
new file mode 100644
index 0000000..62f905f
--- /dev/null
+++ b/src/analysis/retrieval-enrichment.ts
@@ -0,0 +1,180 @@
+import type { AnalysisContext, FileDiff, Finding } from './types.js';
+
+const MAX_RETRIEVAL_TERMS = 18;
+const MAX_FILE_SIGNALS = 5;
+const MAX_RETRIEVAL_TEXT_LENGTH = 2200;
+
+const STOP_WORDS = new Set([
+  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'then',
+  'were', 'have', 'will', 'your', 'their', 'there', 'about', 'after', 'before',
+  'used', 'using', 'user', 'users', 'code', 'repo', 'file', 'files', 'module',
+  'modules', 'value', 'values', 'data', 'type', 'types', 'test', 'tests', 'line',
+  'lines', 'more', 'less', 'very', 'over', 'under', 'same', 'such', 'only',
+  'just', 'than', 'some', 'into', 'also', 'been', 'being', 'make', 'made',
+  'does', 'did', 'done', 'adds', 'added', 'remove', 'removed', 'update',
+  'updated', 'changes', 'change', 'logic', 'system', 'service', 'services',
+  'client', 'clients', 'config', 'schema', 'unknown', 'null', 'true', 'false',
+]);
+
+const MODULE_HINTS: Record<string, readonly string[]> = {
+  complexity: ['algorithmic complexity', 'query cost', 'performance hotspot'],
+  design_patterns: ['design pattern', 'dependency inversion', 'abstraction boundary'],
+  clean_code: ['readability', 'refactor', 'maintainability'],
+  type_system: ['type safety', 'schema typing', 'inference'],
+  integration: ['external service', 'api integration', 'client initialization'],
+  testing: ['automated testing', 'test harness', 'regression safety'],
+  ai_assisted: ['ai workflow', 'prompting', 'model integration'],
+  performance: ['latency', 'throughput', 'resource usage'],
+  security: ['security hardening', 'encryption', 'authentication', 'secrets management'],
+  api_design: ['api contract', 'interface design', 'backward compatibility'],
+  error_resilience: ['error handling', 'retry strategy', 'fault tolerance'],
+  observability: ['tracing', 'logging', 'metrics', 'diagnostics'],
+  concurrency: ['parallelism', 'race condition', 'synchronization'],
+  dx: ['developer experience', 'tooling', 'validation'],
+  dependency_health: ['dependency upgrade', 'versioning', 'supply chain'],
+  evolutionary: ['modularization', 'migration', 'incremental refactor'],
+  js_advanced: ['javascript runtime', 'async control flow', 'language feature'],
+  react_patterns: ['react component design', 'state management', 'rendering'],
+  devops: ['deployment', 'ci cd', 'infrastructure automation'],
+  python_patterns: ['python architecture', 'async python', 'python tooling'],
+  go_patterns: ['go services', 'goroutines', 'go observability'],
+  java_patterns: ['java backend', 'spring or quarkus patterns', 'jvm services'],
+  elixir_patterns: ['beam systems', 'otp', 'elixir architecture'],
+  architecture_patterns: ['system boundaries', 'service decomposition', 'software architecture'],
+};
+
+function splitCamelCase(input: string): string[] {
+  return input
+    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
+    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
+    .split(/\s+/)
+    .filter(Boolean);
+}
+
+function tokenize(input: string): string[] {
+  const rawParts = input
+    .replace(/[@/.:()[\]{}]/g, ' ')
+    .split(/[^A-Za-z0-9_-]+/)
+    .filter(Boolean);
+
+  const tokens: string[] = [];
+  for (const part of rawParts) {
+    const pieces = splitCamelCase(part).flatMap((piece) => piece.split(/[_-]+/));
+    for (const piece of pieces) {
+      const normalized = piece.trim().toLowerCase();
+      if (
+        normalized.length < 3
+        || normalized.length > 32
+        || STOP_WORDS.has(normalized)
+        || /^\d+$/.test(normalized)
+      ) {
+        continue;
+      }
+      tokens.push(normalized);
+    }
+  }
+  return tokens;
+}
+
+function pushUnique<T>(items: T[], value: T): void {
+  if (!items.includes(value)) items.push(value);
+}
+
+function trimSnippet(text: string, maxLength: number): string {
+  const normalized = text.replace(/\s+/g, ' ').trim();
+  if (normalized.length <= maxLength) return normalized;
+  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
+}
+
+function getFileSignals(diffs: readonly FileDiff[], contextHint?: string): string[] {
+  const signals: string[] = [];
+  if (contextHint) pushUnique(signals, contextHint);
+
+  const rankedFiles = [...diffs]
+    .sort((left, right) => (right.additions + right.deletions) - (left.additions + left.deletions))
+    .slice(0, MAX_FILE_SIGNALS)
+    .map((diff) => diff.filename);
+
+  for (const filename of rankedFiles) {
+    pushUnique(signals, filename);
+  }
+
+  return signals.slice(0, MAX_FILE_SIGNALS);
+}
+
+function getCodeSignals(diffs: readonly FileDiff[], commitMessage: string, commitBody?: string): string[] {
+  const weights = new Map<string, number>();
+
+  const addWeight = (token: string, amount: number): void => {
+    weights.set(token, (weights.get(token) ?? 0) + amount);
+  };
+
+  for (const token of tokenize(commitMessage)) addWeight(token, 4);
+  for (const token of tokenize(commitBody ?? '')) addWeight(token, 3);
+
+  for (const diff of diffs) {
+    for (const token of tokenize(diff.filename)) addWeight(token, 2);
+
+    const addedLines = diff.patch
+      .split('\n')
+      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
+      .map((line) => line.slice(1))
+      .filter(Boolean);
+
+    for (const line of addedLines.slice(0, 80)) {
+      const lineWeight = /\b(import|from|new |class |interface |function |const |let |type |enum )/.test(line) ? 2 : 1;
+      for (const token of tokenize(line)) addWeight(token, lineWeight);
+    }
+  }
+
+  return [...weights.entries()]
+    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
+    .slice(0, MAX_RETRIEVAL_TERMS)
+    .map(([token]) => token);
+}
+
+function buildRetrievalText(
+  finding: Finding,
+  ctx: AnalysisContext,
+  retrievalTerms: readonly string[],
+  fileSignals: readonly string[],
+): string {
+  const sections = [
+    `Repository: ${ctx.repo}`,
+    `Module: ${finding.moduleId}`,

--- src/analysis/types.ts
diff --git a/src/analysis/types.ts b/src/analysis/types.ts
index 565d710..5a1beb3 100644
--- a/src/analysis/types.ts
+++ b/src/analysis/types.ts
@@ -36,6 +36,7 @@ export interface FileDiff {
 export interface AnalysisContext {
   diffs: FileDiff[];
   commitMessage: string;
+  commitBody?: string;
   languages: string[];     // detected from file extensions
   repo: string;            // 'owner/repo'
   sha: string;
@@ -49,6 +50,8 @@ export interface Finding {
   plainLanguage: string;   // what Claude should explain in the post
   interestScore: number;   // 1–10
   contextHint?: string;    // e.g. "ReconciliationService.ts in vialabs-net/scrappers"
+  retrievalText?: string;  // richer retrieval-oriented text for article matching
+  retrievalTerms?: string[];
   evidence?: {
     before?: string;       // code snippet or description of before state
     after?: string;        // code snippet or description of after state


--- src/content/matcher.ts
diff --git a/src/content/matcher.ts b/src/content/matcher.ts
index d702cb4..f12b2b9 100644
--- a/src/content/matcher.ts
+++ b/src/content/matcher.ts
@@ -4,6 +4,7 @@ import type { IAIClient } from '../ai/types.js';
 import { logger } from '../utils/logger.js';
 
 const SIMILARITY_THRESHOLD = 0.75;
+const FALLBACK_THRESHOLDS = [0.45, 0.3, 0];
 const QUALITY_GATE = 6;
 const MATCH_WINDOW_DAYS = 30;
 const TOP_CANDIDATES = 3;
@@ -33,30 +34,43 @@ export interface MatchedContext {
 interface FindingInput {
   readonly moduleId: string;
   readonly finding: string;
+  readonly technicalDetail?: string;
   readonly plainLanguage: string;
   readonly contextHint?: string;
+  readonly retrievalText?: string;
+  readonly retrievalTerms?: string[];
 }
 
-/**
- * Stage 1 — pgvector bi-encoder search (~5ms + 1 embedding call per finding).
- *
- * Embeds finding.plainLanguage, searches article_chunks by cosine similarity,
- * deduplicates by article (keep best chunk per article), returns top 3 candidates.
- */
-async function stage1BiEncoder(
-  finding: FindingInput,
-  embedder: IEmbedder,
+interface Stage1Result {
+  readonly candidates: CandidateArticle[];
+  readonly thresholdUsed: number;
+  readonly queryText: string;
+}
+
+function buildRetrievalQuery(finding: FindingInput): string {
+  const sections = [
+    finding.retrievalText,
+    `Headline: ${finding.finding}`,
+    finding.technicalDetail ? `Technical detail: ${finding.technicalDetail}` : '',
+    `Explanation: ${finding.plainLanguage}`,
+    finding.contextHint ? `Code location: ${finding.contextHint}` : '',
+    finding.retrievalTerms?.length ? `Concrete terms: ${finding.retrievalTerms.join(', ')}` : '',
+  ].filter(Boolean);
+
+  return sections.join('\n');
+}
+
+async function fetchCandidateArticles(
   db: SupabaseClient,
+  embedding: number[],
   similarityThreshold: number,
 ): Promise<CandidateArticle[]> {
-  const embedding = await embedder.embed(finding.plainLanguage);
   const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
 
-  // pgvector cosine similarity search via Supabase RPC
   const { data, error } = await db.rpc('match_article_chunks', {
     query_embedding: embedding,
     similarity_threshold: similarityThreshold,
-    match_count: TOP_CANDIDATES * 3,  // fetch more, deduplicate by article below
+    match_count: TOP_CANDIDATES * 3,
     min_quality_score: QUALITY_GATE,
     week_of_cutoff: cutoff,
   });
@@ -67,14 +81,12 @@ async function stage1BiEncoder(
 
   const chunks = (data ?? []) as ChunkRow[];
 
-  // Deduplicate: keep best similarity per article
   const bestByArticle = new Map<string, number>();
   for (const chunk of chunks) {
     const prev = bestByArticle.get(chunk.content_item_id) ?? 0;
     if (chunk.similarity > prev) bestByArticle.set(chunk.content_item_id, chunk.similarity);
   }
 
-  // Sort by similarity DESC, take top 3 unique articles
   const topMatches = [...bestByArticle.entries()]
     .sort((a, b) => b[1] - a[1])
     .slice(0, TOP_CANDIDATES)
@@ -102,6 +114,46 @@ async function stage1BiEncoder(
     .sort((a, b) => b.match_strength - a.match_strength);
 }
 
+/**
+ * Stage 1 — pgvector bi-encoder search (~5ms + 1 embedding call per finding).
+ *
+ * Embeds a retrieval-oriented narrative, searches article_chunks by cosine similarity,
+ * and falls back to looser thresholds before giving up.
+ */
+async function stage1BiEncoder(
+  finding: FindingInput,
+  embedder: IEmbedder,
+  db: SupabaseClient,
+  similarityThreshold: number,
+): Promise<Stage1Result> {
+  const queryText = buildRetrievalQuery(finding);
+  const embedding = await embedder.embed(queryText);
+  const thresholds = [similarityThreshold];
+  for (const fallback of FALLBACK_THRESHOLDS) {
+    if (fallback < similarityThreshold && !thresholds.includes(fallback)) {
+      thresholds.push(fallback);
+    }
+  }
+  if (!thresholds.includes(0)) thresholds.push(0);
+
+  for (const threshold of thresholds) {
+    const candidates = await fetchCandidateArticles(db, embedding, threshold);
+    if (candidates.length > 0) {
+      return {
+        candidates,
+        thresholdUsed: threshold,
+        queryText,
+      };
+    }
+  }
+
+  return {
+    candidates: [],
+    thresholdUsed: thresholds[thresholds.length - 1] ?? similarityThreshold,
+    queryText,
+  };
+}
+
 /**
  * Stage 2 — AI cross-encoder (one batched call per finding, all candidates evaluated together).
  *
@@ -127,7 +179,8 @@ Respond ONLY as a JSON array. No markdown, no explanation outside the array.`;
   const userPrompt = `Code change (finding):
 - Module: ${finding.moduleId}
 - Headline: ${finding.finding}
-- Context: ${finding.plainLanguage}${finding.contextHint ? `\n- File: ${finding.contextHint}` : ''}
+- Technical detail: ${finding.technicalDetail ?? 'n/a'}
+- Context: ${finding.plainLanguage}${finding.contextHint ? `\n- File: ${finding.contextHint}` : ''}${finding.retrievalTerms?.length ? `\n- Concrete terms: ${finding.retrievalTerms.join(', ')}` : ''}
 
 Candidate articles:
 ${candidateList}
@@ -231,11 +284,34 @@ export async function matchFindingsToArticles(
   const similarityThreshold = options?.similarityThreshold ?? SIMILARITY_THRESHOLD;
   for (const finding of findings) {
     try {
-      const candidates = await stage1BiEncoder(finding, embedder, db, similarityThreshold);
-      if (candidates.length === 0) continue;
+      const stage1 = await stage1BiEncoder(finding, embedder, db, similarityThreshold);
+      if (stage1.candidates.length === 0) {
+        logger.info('content.match.stage1_no_candidates', {
+          moduleId: finding.moduleId,

--- src/github/commit-enricher.ts
diff --git a/src/github/commit-enricher.ts b/src/github/commit-enricher.ts
index b72e22a..5b6fb24 100644
--- a/src/github/commit-enricher.ts
+++ b/src/github/commit-enricher.ts
@@ -6,6 +6,8 @@ import type { FileDiff } from '../analysis/types.js';
 export interface EnrichedCommit {
   sha: string;
   message: string;
+  body: string;
+  fullMessage: string;
   repo: string;
   authorLogin: string;
   totalAdditions: number;
@@ -52,10 +54,14 @@ export async function enrichCommit(
 
   const diffs = parseCommitFiles(raw.files ?? []);
   const languages = detectLanguages(diffs);
+  const fullMessage = raw.commit.message ?? '';
+  const [subject, ...bodyLines] = fullMessage.split('\n');
 
   return {
     sha: raw.sha,
-    message: raw.commit.message.split('\n')[0] ?? raw.commit.message,
+    message: subject ?? fullMessage,
+    body: bodyLines.join('\n').trim(),
+    fullMessage,
     repo: `${owner}/${repo}`,
     authorLogin,
     totalAdditions: raw.stats?.additions ?? 0,


--- src/main-poll.ts
diff --git a/src/main-poll.ts b/src/main-poll.ts
index 68dbdbf..58ad2e2 100644
--- a/src/main-poll.ts
+++ b/src/main-poll.ts
@@ -182,7 +182,14 @@ async function main(): Promise<void> {
       }
 
       const pipelineFindings = await runPipeline(
-        { diffs: commit.diffs, commitMessage: commit.message, languages: commit.languages, repo: commit.repo, sha: commit.sha },
+        {
+          diffs: commit.diffs,
+          commitMessage: commit.message,
+          commitBody: commit.body,
+          languages: commit.languages,
+          repo: commit.repo,
+          sha: commit.sha,
+        },
         config.posting.analysis_top_n,
         modules,
         recentModuleIds,


--- src/worker/process-job.ts
diff --git a/src/worker/process-job.ts b/src/worker/process-job.ts
index 417d350..a761108 100644
--- a/src/worker/process-job.ts
+++ b/src/worker/process-job.ts
@@ -264,6 +264,7 @@ export async function processJob(jobId: string, deps: ProcessJobDeps): Promise<v
         {
           diffs: commit.diffs,
           commitMessage: commit.message,
+          commitBody: commit.body,
           languages: commit.languages,
           repo: commit.repo,
           sha: commit.sha,

```

## Claims a labelar

Opciones: `grounded` | `plausible_unsupported` | `contradicted` | `irrelevant` | `frame`

| # | Claim | Pre-label (LLM) | Tu label | Notas |
|---|-------|-----------------|----------|-------|
| 0 | Tenant tokens were sitting in Supabase as plaintext. | needs_human | | |
| 1 | That's the kind of thing that's fine until it isn't. | needs_human | | |
| 2 | One commit changed the shape of that risk entirely. | needs_human | | |
| 3 | The new flow is envelope encryption backed by GCP KMS. | needs_human | | |
| 4 | When a tenant onboards or completes an OAuth callback, `sealTenantSecrets` encrypts the Buffer and LinkedIn credentials before they're written. | needs_human | | |
| 5 | At runtime, the worker and scanner call `resolveTenantSecrets` to decrypt via KMS. | needs_human | | |
| 6 | The data encryption key lives in an `encrypted_dek` column in Supabase — the KMS key never touches the credential directly. | needs_human | | |
| 7 | That's the classic envelope pattern: KMS protects the DEK, the DEK protects the data. | needs_human | | |
| 8 | Rotating the KMS key doesn't require re-encrypting every row. | needs_human | | |
| 9 | Re-encrypting rows doesn't require touching KMS quotas. | needs_human | | |
| 10 | The two concerns stay decoupled. | needs_human | | |
| 11 | A rotation script also ships alongside — specifically to re-encrypt legacy plaintext rows that were already stored. | needs_human | | |
| 12 | The migration path is handled, not left as a follow-up. | needs_human | | |
| 13 | Then, two days later, KMS key name gets wired into CI secrets and the bootstrap step runs under the same credential scope. | needs_human | | |
| 14 | The security boundary isn't just in the app code — it propagates into the pipeline. | needs_human | | |
| 15 | The ADR covering this landed as ADR-accepted before implementation, which means the decision record and the working code arrived in the same window. | needs_human | | |
| 16 | That's the part that usually slips. | needs_human | | |
| 17 | What changed: tenant credentials now have a concrete threat model. | needs_human | | |
| 18 | The failure mode isn't "someone reads the DB." It's "someone also compromises KMS" — a meaningfully harder bar. | needs_human | | |

## Post-level

- **Publish readiness:** [ ] publish_asis [ ] light_edit [ ] rewrite [ ] discard
- **¿Qué te haría desconfiar del post?** _______
