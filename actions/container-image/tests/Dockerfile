# A tiny image for testing the action: two stages, so `target` can be tested too.
FROM busybox:1.37 AS base
ARG GREETING=hello
RUN echo "$GREETING" > /greeting

FROM base AS final
CMD ["cat", "/greeting"]
