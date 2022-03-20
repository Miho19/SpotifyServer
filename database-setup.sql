USE spotify-friends;

CREATE TABLE IF NOT EXISTS token (
    id INT AUTO_INCREMENT NOT NULL,
    name VARCHAR(255) NOT NULL,
    refreshToken VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    PRIMARY KEY(id)
);


desc token;

