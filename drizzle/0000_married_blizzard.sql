CREATE TABLE "atendimento_humano" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefone" text NOT NULL,
	"nome" text,
	"data_envio" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "Interesse do cliente" (
	"id" serial PRIMARY KEY NOT NULL,
	"userID" text NOT NULL,
	"Procedimento" text,
	"Data_envio" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads_quentes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text,
	"numero" text NOT NULL,
	"criado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pré agendamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"userID" text NOT NULL,
	"NomeCompleto" text,
	"período_do_dia" text,
	"Data_envio" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_traces" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"contact_inbox_source_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"total_input_tokens" integer NOT NULL,
	"total_output_tokens" integer NOT NULL,
	"estimated_cost_usd" numeric(10, 6) NOT NULL,
	"tool_call_count" integer NOT NULL,
	"error_count" integer NOT NULL,
	"events" jsonb NOT NULL
);
