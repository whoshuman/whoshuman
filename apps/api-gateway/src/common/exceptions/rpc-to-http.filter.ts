import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): unknown;
}

@Catch(RpcException)
export class RpcToHttpExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const rpcError = exception.getError();

    if (typeof rpcError === "string") {
      response.status(400).json({
        statusCode: 400,
        message: rpcError
      });
      return;
    }

    if (typeof rpcError === "object" && rpcError !== null) {
      const { status, message, ...rest } = rpcError as Record<string, unknown> & {
        status?: number | string;
        message?: string;
      };
      const httpStatus = Number.isNaN(Number(status)) ? 400 : Number(status);

      response.status(httpStatus).json({
        statusCode: httpStatus,
        message: message ?? "Request failed",
        ...rest
      });
      return;
    }

    response.status(500).json({
      statusCode: 500,
      message: "Unexpected RPC error"
    });
  }
}
