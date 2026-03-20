<?php

declare(strict_types=1);

namespace KangOpenBanking\Exceptions;

class KOBException extends \Exception
{
    public readonly int $statusCode;
    public readonly string $errorCode;
    public readonly string $errorId;

    public function __construct(int $statusCode, array $body)
    {
        $this->statusCode = $statusCode;
        $this->errorCode = $body['error_code'] ?? 'UNKNOWN';
        $this->errorId = $body['error_id'] ?? '';

        $message = $body['message'] ?? $body['error'] ?? 'Unknown API error';
        parent::__construct("[{$this->errorCode}] {$message}", $statusCode);
    }
}
