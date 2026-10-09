---
type: lesson
title: Checks need counterexamples
summary: A checker proven only on valid input may accept everything; test it against a broken case too.
tags: [kind/pitfall]
created: 2026-10-09
updated: 2026-10-09
agent: claude-code
status: active
---

## What happened

A checker passed every valid document and every broken one.

## Fix

Each checker now ships with a broken fixture that must fail.

## How to apply

Write the broken case first and watch it fail.
